import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { RefreshToken } from './refresh-token.entity';
import { AuthToken, AuthTokenPurpose } from './auth-token.entity';
import { parseDuration } from '../common/duration';

export interface TokenContext {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedRefreshToken {
  token: string;      // valor en claro — solo viaja a la cookie, nunca se guarda
  expiresAt: Date;
  familyId: string;
}

/** Se lanza cuando alguien presenta un refresh token ya rotado (robo probable). */
export class RefreshTokenReuseError extends Error {}
/** Token inexistente, caducado o revocado individualmente. */
export class RefreshTokenInvalidError extends Error {}

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

@Injectable()
export class TokensService {
  private readonly log = new Logger('TokensService');
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(RefreshToken) private readonly refresh: Repository<RefreshToken>,
    @InjectRepository(AuthToken) private readonly authTokens: Repository<AuthToken>,
    config: ConfigService,
  ) {
    this.refreshTtlMs = parseDuration(
      config.get<string>('REFRESH_TOKEN_TTL'), 30 * 86_400_000,   // 30 días
    );
  }

  /* ---------------- refresh tokens ---------------- */

  /** Crea un refresh token nuevo. Sin `familyId` arranca una familia (= login nuevo). */
  async issueRefresh(
    userId: string, ctx: TokenContext = {}, familyId?: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    const family = familyId ?? randomUUID();
    await this.refresh.save(this.refresh.create({
      userId,
      tokenHash: sha256(token),
      familyId: family,
      expiresAt,
      userAgent: (ctx.userAgent ?? null)?.slice(0, 255) ?? null,
      ip: (ctx.ip ?? null)?.slice(0, 64) ?? null,
    }));
    return { token, expiresAt, familyId: family };
  }

  /**
   * Rota un refresh token: revoca el presentado y emite uno nuevo en la misma
   * familia. Si el presentado ya estaba revocado es que se está reutilizando un
   * token viejo — señal de robo — y tumbamos la familia entera.
   */
  async rotate(
    rawToken: string, ctx: TokenContext = {},
  ): Promise<{ userId: string; issued: IssuedRefreshToken }> {
    const hash = sha256(rawToken);
    const current = await this.refresh.findOne({ where: { tokenHash: hash } });
    if (!current) throw new RefreshTokenInvalidError('Refresh token desconocido.');

    if (current.revokedAt) {
      this.log.warn(
        `Reutilización de refresh token detectada (usuario ${current.userId}). ` +
        `Se revoca la familia ${current.familyId} entera.`,
      );
      await this.revokeFamily(current.familyId);
      throw new RefreshTokenReuseError('Refresh token ya utilizado.');
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      throw new RefreshTokenInvalidError('Refresh token caducado.');
    }

    const issued = await this.issueRefresh(current.userId, ctx, current.familyId);
    current.revokedAt = new Date();
    current.replacedByHash = sha256(issued.token);
    await this.refresh.save(current);

    return { userId: current.userId, issued };
  }

  async revokeByToken(rawToken: string): Promise<void> {
    await this.refresh.update(
      { tokenHash: sha256(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refresh.createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('family_id = :familyId AND revoked_at IS NULL', { familyId })
      .execute();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refresh.createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();
  }

  /** Sesiones vivas del usuario, para la pantalla "dispositivos conectados". */
  async listActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refresh.createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.revoked_at IS NULL')
      .andWhere('t.expires_at > now()')
      .orderBy('t.created_at', 'DESC')
      .getMany();
  }

  /* ---------------- tokens de un solo uso (email) ---------------- */

  /** Devuelve el token en claro; en BD queda solo el hash. */
  async createAuthToken(
    userId: string, purpose: AuthTokenPurpose, ttlMs: number,
  ): Promise<string> {
    // Un solo token vivo por propósito: pedir otro reset invalida el anterior.
    await this.authTokens.createQueryBuilder()
      .update(AuthToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId AND purpose = :purpose AND used_at IS NULL',
        { userId, purpose })
      .execute();

    const token = randomBytes(32).toString('base64url');
    await this.authTokens.save(this.authTokens.create({
      userId,
      purpose,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
    }));
    return token;
  }

  /** Valida y marca como usado. Devuelve el userId, o null si no sirve. */
  async consumeAuthToken(
    rawToken: string, purpose: AuthTokenPurpose,
  ): Promise<string | null> {
    const row = await this.authTokens.findOne({
      where: { tokenHash: sha256(rawToken), purpose },
    });
    if (!row) return null;
    if (row.usedAt) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;

    row.usedAt = new Date();
    await this.authTokens.save(row);
    return row.userId;
  }

  /** Limpieza de filas muertas; la llama el cron de AuthService. */
  async purgeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    await this.refresh.delete({ expiresAt: LessThan(cutoff) });
    await this.authTokens.delete({ expiresAt: LessThan(cutoff) });
  }
}
