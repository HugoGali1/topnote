import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { User } from './users/user.entity';
import { Favorite } from './favorites/favorite.entity';
import { HistoryEntry } from './history/history.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { AuthToken } from './auth/auth-token.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { FavoritesModule } from './favorites/favorites.module';
import { HistoryModule } from './history/history.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { CsrfGuard } from './common/csrf.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    /**
     * Rate limit global por IP. Los endpoints de auth lo aprietan mucho más con
     * @Throttle (ver auth.controller.ts); esto es solo el techo general para
     * que nadie machaque el catálogo o las recomendaciones.
     */
    ThrottlerModule.forRoot([{ name: 'short', ttl: 60_000, limit: 120 }]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL is required (see .env.example)');
        // Cualquier Postgres gestionado (Neon, Supabase, RDS…) exige SSL desde
        // fuera del cluster. Solo lo desactivamos contra una base local.
        const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
        return {
          type: 'postgres',
          url,
          entities: [User, Favorite, HistoryEntry, RefreshToken, AuthToken],
          // El esquema lo gobiernan las migraciones de src/migrations. Con
          // synchronize:true TypeORM alteraba tablas solo al arrancar, que en
          // producción es una forma cómoda de perder datos.
          synchronize: false,
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
          migrationsTableName: 'migrations',
          // Aplicarlas al arrancar es cómodo y seguro aquí porque son
          // idempotentes. Pon RUN_MIGRATIONS=false si prefieres lanzarlas tú
          // desde el pipeline de despliegue.
          migrationsRun: config.get<string>('RUN_MIGRATIONS') !== 'false',
          ssl: isLocal ? false : { rejectUnauthorized: false },
        };
      },
    }),

    MailModule,
    UsersModule,
    AuthModule,
    FavoritesModule,
    HistoryModule,
    RecommendationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Corre en todas las rutas: exige X-CSRF-Token en las peticiones que mutan
    // estado y vienen autenticadas por cookie.
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
