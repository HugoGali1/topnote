import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../common/jwt.strategy';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { BulkFavoritesDto } from './dto/bulk-favorites.dto';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favs: FavoritesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser): Promise<{ ids: string[] }> {
    const ids = await this.favs.listIds(user.id);
    return { ids };
  }

  @Post()
  @HttpCode(201)
  async add(@CurrentUser() user: RequestUser, @Body() dto: AddFavoriteDto) {
    await this.favs.add(user.id, dto.perfumeId);
    return { ok: true };
  }

  @Post('bulk')
  @HttpCode(201)
  async bulk(@CurrentUser() user: RequestUser, @Body() dto: BulkFavoritesDto) {
    const inserted = await this.favs.bulkAdd(user.id, dto.perfumeIds);
    const ids = await this.favs.listIds(user.id);
    return { inserted, ids };
  }

  @Delete(':perfumeId')
  @HttpCode(204)
  async remove(@CurrentUser() user: RequestUser, @Param('perfumeId') perfumeId: string) {
    await this.favs.remove(user.id, perfumeId);
  }
}
