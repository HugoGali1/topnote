import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly repo: Repository<Favorite>,
  ) {}

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: { perfumeId: true },
    });
    return rows.map((r) => r.perfumeId);
  }

  async add(userId: string, perfumeId: string): Promise<void> {
    // upsert-like: si ya existe lo ignoramos.
    const existing = await this.repo.findOne({ where: { userId, perfumeId } });
    if (existing) return;
    const fav = this.repo.create({ userId, perfumeId });
    await this.repo.save(fav);
  }

  async remove(userId: string, perfumeId: string): Promise<void> {
    await this.repo.delete({ userId, perfumeId });
  }

  /**
   * Inserta en masa. Dedupica internamente y con la unique constraint de DB,
   * así que es idempotente: llamar dos veces con los mismos ids no duplica.
   * Devuelve cuántos eran nuevos.
   */
  async bulkAdd(userId: string, perfumeIds: string[]): Promise<number> {
    const unique = Array.from(new Set(perfumeIds.filter(Boolean)));
    if (!unique.length) return 0;

    const existing = await this.repo.find({
      where: unique.map((perfumeId) => ({ userId, perfumeId })),
      select: { perfumeId: true },
    });
    const existingSet = new Set(existing.map((r) => r.perfumeId));
    const toInsert = unique.filter((id) => !existingSet.has(id));
    if (!toInsert.length) return 0;

    const rows = toInsert.map((perfumeId) => this.repo.create({ userId, perfumeId }));
    await this.repo.save(rows);
    return rows.length;
  }
}
