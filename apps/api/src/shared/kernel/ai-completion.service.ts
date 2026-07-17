import { Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { collectApiKeys, geminiText, openAiText } from './ai-response';

const GEMINI_KEY_COUNT = 6;
const SAMBANOVA_KEY_COUNT = 8;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const SAMBANOVA_URL = 'https://api.sambanova.ai/v1/chat/completions';
const SAMBANOVA_MODEL = 'Meta-Llama-3.3-70B-Instruct';

export interface AiCompletionOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Erro de IA indisponível — todos os provedores/chaves falharam. */
export class AiUnavailableError extends Error {
  constructor() {
    super('AI service unavailable — all providers exhausted');
    this.name = 'AiUnavailableError';
  }
}

/**
 * Completions de IA com fallback multi-provedor: Gemini (6 chaves) → SambaNova
 * (8 chaves), rodando cada chave em rotação. Fonte ÚNICA — antes essa cadeia
 * inteira estava duplicada em plans.module.ts e runs.module.ts.
 */
@Injectable()
export class AiCompletionService {
  constructor(private readonly cfg: ConfigService) {}

  private get = (name: string) => this.cfg.get<string>(name);

  /** Há alguma chave de IA configurada? */
  hasProvider(): boolean {
    return this.geminiKeys().length > 0 || this.sambanovaKeys().length > 0;
  }

  private geminiKeys(): string[] {
    return collectApiKeys(this.get, 'GEMINI_API_KEY', GEMINI_KEY_COUNT);
  }

  private sambanovaKeys(): string[] {
    return collectApiKeys(this.get, 'SAMBANOVA_API_KEY', SAMBANOVA_KEY_COUNT);
  }

  /** Texto gerado. Lança AiUnavailableError se todos os provedores falharem. */
  async complete(prompt: string, opts?: AiCompletionOptions): Promise<string> {
    const maxTokens = opts?.maxTokens ?? 1024;
    const temperature = opts?.temperature ?? 0.7;

    for (const apiKey of this.geminiKeys()) {
      const text = await this.tryGemini(apiKey, prompt, opts, maxTokens, temperature);
      if (text) return text;
    }
    for (const apiKey of this.sambanovaKeys()) {
      const text = await this.trySambanova(apiKey, prompt, opts, maxTokens, temperature);
      if (text) return text;
    }
    throw new AiUnavailableError();
  }

  private async tryGemini(
    apiKey: string, prompt: string, opts: AiCompletionOptions | undefined,
    maxTokens: number, temperature: number,
  ): Promise<string> {
    try {
      const text = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt;
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      });
      if (!res.ok) return '';
      return geminiText(await res.json());
    } catch {
      return ''; // chave/rede falhou — tenta a próxima
    }
  }

  private async trySambanova(
    apiKey: string, prompt: string, opts: AiCompletionOptions | undefined,
    maxTokens: number, temperature: number,
  ): Promise<string> {
    try {
      const messages: { role: string; content: string }[] = [];
      if (opts?.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
      messages.push({ role: 'user', content: prompt });
      const res = await fetch(SAMBANOVA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: SAMBANOVA_MODEL, messages, max_tokens: maxTokens, temperature }),
      });
      if (!res.ok) return '';
      return openAiText(await res.json());
    } catch {
      return ''; // chave/rede falhou — tenta a próxima
    }
  }
}

@Module({
  imports: [ConfigModule],
  providers: [AiCompletionService],
  exports: [AiCompletionService],
})
export class AiCompletionModule {}
