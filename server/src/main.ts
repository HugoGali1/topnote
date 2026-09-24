import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const log = new Logger('bootstrap');

  // La sesión vive en cookies httpOnly: sin esto req.cookies llega vacío.
  app.use(cookieParser());

  // Detrás de un proxy (Vercel, Render, Nginx) sin esto req.ip es la IP del
  // proxy, o sea la misma para todo el mundo: el rate limit por IP dejaría de
  // distinguir usuarios y las cookies Secure no se marcarían bien.
  if (config.get<string>('TRUST_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!origins.length) {
    // `origin: true` refleja el Origin que venga. Con credentials:true eso
    // significa que cualquier web podría hablar con la API usando las cookies
    // del usuario, así que aquí no se permite: hay que declarar los orígenes.
    throw new Error(
      'CORS_ORIGINS es obligatorio: con cookies de sesión no se puede abrir ' +
      'la API a cualquier origen. Ejemplo: CORS_ORIGINS=http://localhost:8000',
    );
  }

  app.enableCors({
    origin: origins,
    // Necesario para que el navegador mande y acepte las cookies de sesión
    // en peticiones cross-origin (el front va en otro puerto).
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
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
  log.log(`listening on http://localhost:${port}/api`);
  log.log(`CORS permitido para: ${origins.join(', ')}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[topnote-server] failed to start', err);
  process.exit(1);
});
