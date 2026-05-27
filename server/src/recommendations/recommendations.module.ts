import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [GeminiModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
