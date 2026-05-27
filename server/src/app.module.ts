import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Favorite } from './favorites/favorite.entity';
import { HistoryEntry } from './history/history.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module';
import { HistoryModule } from './history/history.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL is required (see .env.example)');
        // Supabase requiere SSL en conexiones desde fuera del cluster.
        const isSupabase = /supabase\.(co|com)/.test(url);
        return {
          type: 'postgres',
          url,
          entities: [User, Favorite, HistoryEntry],
          synchronize: true,   // dev: crea las tablas automáticamente. Migrar a CLI en prod.
          ssl: isSupabase ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    UsersModule,
    AuthModule,
    FavoritesModule,
    HistoryModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
