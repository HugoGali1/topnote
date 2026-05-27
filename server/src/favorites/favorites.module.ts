import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './favorite.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
