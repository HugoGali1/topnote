import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ResponseSchema {
  type: 'ARRAY' | 'OBJECT' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';
  items?: ResponseSchema;
  properties?: Record<string, ResponseSchema>;
  required?: string[];
}

/**
 * Cliente Gemini 2.5 Flash para LLM ranking.
 * - Free tier: 1500 RPD, 10 RPM, multilingüe.
 * - responseSchema garantiza JSON estructurado sin parseo frágil.
 * - thinkingConfig.thinkingBudget=0 desactiva el "thinking" interno
 *   (consume tokens del maxOutputTokens y para ranking no aporta).
 */
@Injectable()
export class GeminiService {
  private readonly defaultModel = 'gemini-2.5-flash-lite';
  private readonly base = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY no está configurada en el servidor.',
      );
    }
    return key;
  }

  /**
   * Genera contenido y devuelve el texto (o el JSON ya parseado si se pasa schema).
   */
  async generate(opts: {
    system?: string;
    user: string;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
    responseSchema?: ResponseSchema;
  }): Promise<string> {
    const model = opts.model || this.defaultModel;
    const url = `${this.base}/models/${model}:generateContent?key=${this.apiKey}`;

    const generationConfig: any = {
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      temperature: opts.temperature ?? 0.4,
      // Desactivamos thinking en gemini 2.5 Flash — los tokens de razonamiento
      // interno consumen maxOutputTokens y para ranking determinista no aporta.
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (opts.responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = opts.responseSchema;
    }

    const body: any = {
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig,
    };
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }

    // Reintento con backoff:
    //  - 503/5xx (modelo sobrecargado): backoff corto (transitorio)
    //  - 429 (rate limit): backoff largo (esperar a que el minuto reset)
    //  - 4xx genuinos: no reintentar
    const backoffsRetry  = [1200, 3500, 8000];   // 503/5xx
    const backoffsRateLm = [5000, 15000, 30000]; // 429
    let res: Response | null = null;
    let lastErr = '';
    let attempt = 0;
    while (true) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) break;
      const is429 = res.status === 429;
      const is5xx = res.status >= 500;
      lastErr = await res.text().catch(() => '');
      if ((!is429 && !is5xx) || attempt >= backoffsRetry.length) {
        throw new InternalServerErrorException(
          `Gemini falló (${res.status}): ${lastErr.slice(0, 400)}`,
        );
      }
      const delay = is429 ? backoffsRateLm[attempt] : backoffsRetry[attempt];
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
    const data: any = await res!.json();
    const candidates = data?.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || '').join('');
    if (!text) {
      throw new InternalServerErrorException('Gemini devolvió respuesta vacía.');
    }
    return text;
  }
}
