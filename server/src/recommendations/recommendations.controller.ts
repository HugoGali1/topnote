import { Body, Controller, Post } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RankDto } from './dto/rank.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recs: RecommendationsService) {}

  /**
   * POST /api/recommendations/rank
   * Body: { query, filters?, candidates }
   * Re-ranking con Claude. Devuelve 3-5 con score y razonamiento.
   *
   * El prefilter de candidatos lo hace el frontend (keywords + score de notas).
   */
  @Post('rank')
  async rank(@Body() dto: RankDto) {
    const results = await this.recs.rank(dto);
    return { results };
  }
}
