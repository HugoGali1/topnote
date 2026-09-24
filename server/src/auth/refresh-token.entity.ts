import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Refresh token opaco (32 bytes aleatorios). En base de datos guardamos solo su
 * SHA-256: si alguien se lleva un dump de la tabla no obtiene tokens usables.
 *
 * Cada token pertenece a una "familia" (`familyId`): la cadena de rotaciones que
 * arranca en un login. Al rotar, el token viejo queda revocado y apunta al nuevo
 * con `replacedByHash`. Si más tarde alguien presenta ese token ya revocado
 * significa que fue robado (el legítimo ya rotó), así que revocamos la familia
 * entera — detección de reutilización.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  /** SHA-256 hex del token en claro. Único: es la clave de búsqueda. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash!: string;

  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'replaced_by_hash', nullable: true })
  replacedByHash!: string | null;

  /** Contexto del login, para que el usuario pueda reconocer sus sesiones. */
  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ip', nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
