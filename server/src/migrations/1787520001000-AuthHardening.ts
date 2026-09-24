import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Endurecimiento de auth:
 *  - `users.email_verified_at` → verificación de email.
 *  - `users.token_version`     → revocación de access tokens ya emitidos.
 *  - `refresh_tokens`          → sesiones rotatorias y revocables.
 *  - `auth_tokens`             → tokens de un solo uso (verificar / resetear).
 */
export class AuthHardening1787520001000 implements MigrationInterface {
  name = 'AuthHardening1787520001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"          uuid NOT NULL,
        "token_hash"       character varying(64) NOT NULL,
        "family_id"        uuid NOT NULL,
        "expires_at"       TIMESTAMP NOT NULL,
        "revoked_at"       TIMESTAMP,
        "replaced_by_hash" character varying(64),
        "user_agent"       character varying(255),
        "ip"               character varying(64),
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_token_hash"
        ON "refresh_tokens" ("token_hash")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id"
        ON "refresh_tokens" ("user_id")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family_id"
        ON "refresh_tokens" ("family_id")
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "auth_tokens" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid NOT NULL,
        "purpose"    character varying(32) NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at"    TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_tokens" PRIMARY KEY ("id")
      )
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_auth_tokens_token_hash"
        ON "auth_tokens" ("token_hash")
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_tokens_user_id"
        ON "auth_tokens" ("user_id")
    `);

    // Las cuentas que ya existían se dan por verificadas: se crearon antes de
    // que hubiera verificación y bloquearlas ahora dejaría al usuario fuera.
    await q.query(`
      UPDATE "users" SET "email_verified_at" = "created_at"
       WHERE "email_verified_at" IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "auth_tokens"`);
    await q.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await q.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "token_version",
        DROP COLUMN IF EXISTS "email_verified_at"
    `);
  }
}
