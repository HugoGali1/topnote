import { BadRequestException, Injectable } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { RankDto, RankCandidateDto } from './dto/rank.dto';

export interface RankedResult {
  id: string;
  score: number;
  reasoning: string;
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly gemini: GeminiService) {}

  /**
   * Re-ranking con Gemini 2.5 Flash. Recibe query + N candidatos pre-filtrados
   * por el cliente y devuelve los 3-5 mejores con score y razonamiento.
   * Usa responseSchema para garantizar JSON estructurado.
   */
  async rank(dto: RankDto): Promise<RankedResult[]> {
    if (!dto.candidates.length) {
      throw new BadRequestException('No hay candidatos para rankear.');
    }
    const compact = dto.candidates.map((c) => this.compactCandidate(c));

    const system =
`Eres un perfumista profesional con 20 años de experiencia. Tu trabajo es seleccionar entre 6 y 8 fragancias del subconjunto dado que MEJOR encajen con la petición del usuario.

PROCESO MENTAL (interno):
1. Extrae el INTENTO del usuario:
   - OCASIÓN (oficina/diario/casual, noche/evento, cita romántica, deporte, viaje…)
   - MOOD (dulce, fresco, intenso, elegante, discreto, sensual, misterioso…)
   - TEMPORADA implícita (verano→fresco/acuático, invierno→cálido/gourmand/amaderado…)
   - GÉNERO o estilo
   - REFERENCIAS a perfumes conocidos ("como X", "parecido a Y", "menos común que Z")
   - RESTRICCIONES negativas ("sin vainilla", "que no sea fuerte", "menos popular")
2. Para cada candidato evalúa el FIT contra cada dimensión:
   - ¿Sus acordes y pirámide olfativa encajan con el mood?
   - ¿Su perfil sirve para la ocasión solicitada? (oficina ≠ noche)
   - ¿Concuerda con la temporada y género?
   - Si hay referencia, ¿comparte ADN olfativo (no marca)?
3. Penaliza los que solo coinciden por una palabra pero el perfil global NO encaja.
4. Selecciona 6-8 con FIT real (mínimo 4 si los candidatos son flojos). Variedad mejor que repetición.

SCORING (0-100):
- 90-100: encaja en todas las dimensiones principales.
- 75-89: encaja muy bien en mood + ocasión.
- 60-74: match parcial defendible.
- < 55: NO lo incluyas.

REASONING:
- 2-3 frases en español natural y elegante. Tono editorial de revista.
- ESPECÍFICO: nombra notas/acordes concretos y conéctalos al intento.
- Si el usuario mencionó otro perfume, explica el paralelismo olfativo.
- Prohibido: "aroma único", "perfecto para ti", "esencia cautivadora", propaganda genérica.

OTRAS REGLAS:
- rating (0-10) y rating_count son priors SECUNDARIOS. No descartes joyas nicho.
- Los filtros duros (familia/género/temporada) ya están aplicados.
- Diversifica casas si puedes: evita 4 de 5 de la misma marca salvo que sea claramente lo mejor.

Devuelve un array JSON ordenado de mayor a menor score. Sin texto adicional.`;

    const user =
`PETICIÓN DEL USUARIO:
"${dto.query}"

FILTROS UI (ya aplicados, contexto):
${JSON.stringify(dto.filters || {})}

CANDIDATOS PRE-FILTRADOS (${compact.length}):
${JSON.stringify(compact)}`;

    // responseSchema fuerza a Gemini a devolver un array bien tipado.
    const responseSchema = {
      type: 'ARRAY' as const,
      items: {
        type: 'OBJECT' as const,
        properties: {
          id:        { type: 'STRING' as const },
          score:     { type: 'INTEGER' as const },
          reasoning: { type: 'STRING' as const },
        },
        required: ['id', 'score', 'reasoning'],
      },
    };

    const raw = await this.gemini.generate({
      system,
      user,
      responseSchema,
      maxOutputTokens: 8192,
      temperature: 0.4,
    });

    return this.parseRanked(raw, new Set(dto.candidates.map((c) => c.id)));
  }

  private compactCandidate(c: RankCandidateDto) {
    return {
      id: c.id,
      nombre: c.nombre,
      casa: c.casa,
      año: c.ano,
      notas: c.notas,
      familia: c.familia,
      acordes: c.acordes,
      temporada: c.temporada,
      genero: c.genero,
      rating: c.rating,
      rating_count: c.rating_count,
      similares_a: c.similares_a,
    };
  }

  private parseRanked(raw: string, validIds: Set<string>): RankedResult[] {
    let s = String(raw).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const m = s.match(/\[[\s\S]*\]/);
    if (m) s = m[0];

    let parsed: any;
    try {
      parsed = JSON.parse(s);
    } catch {
      // Reparación: si quedó truncado, cierra tras el último `}`.
      const last = s.lastIndexOf('}');
      if (last > 0) {
        try { parsed = JSON.parse(s.slice(0, last + 1) + ']'); }
        catch { throw new BadRequestException('Respuesta del modelo no parseable.'); }
      } else {
        throw new BadRequestException('Respuesta del modelo no parseable.');
      }
    }
    if (!Array.isArray(parsed)) {
      const arr = Object.values(parsed || {}).find((v) => Array.isArray(v));
      parsed = arr || [];
    }
    return (parsed as any[])
      .filter((r) => r && typeof r.id === 'string' && validIds.has(r.id))
      .map((r) => ({
        id: r.id,
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        reasoning: String(r.reasoning || '').trim(),
      }))
      .slice(0, 8);
  }
}
