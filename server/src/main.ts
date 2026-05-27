import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[topnote-server] listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[topnote-server] failed to start', err);
  process.exit(1);
});
