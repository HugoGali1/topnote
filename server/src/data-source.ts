import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

loadEnv();

/**
 * DataSource para la CLI de TypeORM (`npm run migration:*`).
 * El servidor no usa este fichero: construye el suyo en app.module.ts.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required (ver .env.example)');

export default new DataSource({
  type: 'postgres',
  url,
  // Mismo criterio que app.module.ts: SSL salvo contra una base local.
  ssl: /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url) ? false : { rejectUnauthorized: false },
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
});
