import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryEntry } from './history.entity';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HistoryEntry])],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
