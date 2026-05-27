import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistoryEntry } from './history.entity';

const MAX_ENTRIES_PER_USER = 50;

export interface HistoryDTO {
  id: string;
  query: string;
  filters: Record<string, unknown> | null;
  timestamp: number;
}

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(HistoryEntry) private readonly repo: Repository<HistoryEntry>,
  ) {}

  async list(userId: string, limit = 10): Promise<HistoryDTO[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((r) => ({
      id: r.id,
      query: r.query,
      filters: r.filters,
      timestamp: r.createdAt.getTime(),
    }));
  }

  async add(userId: string, input: {
    query: string;
    filters?: Record<string, unknown>;
  }): Promise<HistoryDTO> {
    // Deduplica: si ya existe la misma query, la borra para reinsertar arriba.
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId AND query = :query', { userId, query: input.query })
      .execute();

    const entry = this.repo.create({
      userId,
      query: input.query,
      filters: input.filters ?? null,
    });
    const saved = await this.repo.save(entry);

    // Trim: deja solo las últimas N por usuario.
    const all = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: { id: true },
    });
    if (all.length > MAX_ENTRIES_PER_USER) {
      const toRemove = all.slice(MAX_ENTRIES_PER_USER).map((r) => r.id);
      if (toRemove.length) await this.repo.delete(toRemove);
    }

    return {
      id: saved.id,
      query: saved.query,
      filters: saved.filters,
      timestamp: saved.createdAt.getTime(),
    };
  }

  async clear(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  /**
   * Inserta en masa varias entradas. El orden importa: la última entrada del
   * array queda como la más reciente (la primera entrada que aplica). Para
   * mantener la lista existente respeta la dedup por query y aplica el trim.
   */
  async bulkAdd(userId: string, entries: Array<{
    query: string;
    filters?: Record<string, unknown>;
  }>): Promise<number> {
    if (!entries.length) return 0;
    let count = 0;
    for (const entry of entries) {
      if (!entry || !entry.query || !entry.query.trim()) continue;
      await this.add(userId, entry);
      count++;
    }
    return count;
  }
}
