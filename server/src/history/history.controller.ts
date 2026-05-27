import {
  Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../common/jwt.strategy';
import { HistoryService } from './history.service';
import { AddHistoryDto } from './dto/add-history.dto';
import { BulkHistoryDto } from './dto/bulk-history.dto';

@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const entries = await this.history.list(user.id, limit ? Number(limit) : 10);
    return { entries };
  }

  @Post()
  @HttpCode(201)
  async add(@CurrentUser() user: RequestUser, @Body() dto: AddHistoryDto) {
    const entry = await this.history.add(user.id, dto);
    return { entry };
  }

  @Post('bulk')
  @HttpCode(201)
  async bulk(@CurrentUser() user: RequestUser, @Body() dto: BulkHistoryDto) {
    const inserted = await this.history.bulkAdd(user.id, dto.entries);
    const entries = await this.history.list(user.id);
    return { inserted, entries };
  }

  @Delete()
  @HttpCode(204)
  async clear(@CurrentUser() user: RequestUser) {
    await this.history.clear(user.id);
  }
}
