import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline: el esquema tal y como lo dejó `synchronize: true` antes de que
 * pasáramos a migraciones explícitas.
 *
 * Todo va con IF NOT EXISTS y con los MISMOS nombres de índice que generó
 * TypeORM, para que en la base de datos que ya existe esta migración sea un
 * no-op y en una base de datos nueva cree el esquema completo.
 */
export class BaselineSchema1787520000000 implements MigrationInterface {
  name = 'BaselineSchema1787520000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email"         character varying(254) NOT NULL,
        "name"          character varying(80) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "gender"        character varying(16),
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be"
        ON "users" ("email")
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "favorites" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid NOT NULL,
        "perfume_id" character varying(120) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_034b2de8388b6cfa8a2939842a7" UNIQUE ("user_id", "perfume_id")
      )
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_35a6b05ee3b624d0de01ee5059"
        ON "favorites" ("user_id")
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "history" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid NOT NULL,
        "query"      text NOT NULL,
        "filters"    jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_9384942edf4804b38ca0ee51416" PRIMARY KEY ("id")
      )
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ea92daa642af67e2a924a5547d"
        ON "history" ("user_id")
    `);
  }

  public async down(): Promise<void> {
    // Revertir el baseline significaría borrar users/favorites/history — es
    // decir, todas las cuentas y sus datos. No lo hacemos automáticamente: si
    // de verdad quieres tirar el esquema, hazlo a mano y de forma consciente.
    throw new Error(
      'BaselineSchema no es reversible: destruiría todas las cuentas. ' +
      'Haz el DROP a mano si es lo que quieres.',
    );
  }
}
