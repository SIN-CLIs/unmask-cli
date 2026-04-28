import { generateObject, generateText } from 'ai';
import { z, type ZodTypeAny } from 'zod';

export interface LLMConfig {
  /** Model id passed straight to AI SDK (Vercel AI Gateway). */
  model?: string;
  /** Per-call timeout. Default 30s. */
  timeoutMs?: number;
  /** Max output tokens. */
  maxTokens?: number;
  /** Force-disable LLM even if env is set. */
  disabled?: boolean;
}

export function isLLMAvailable(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.ANTHROPIC_API_KEY);
}

/**
 * Default model is `google/gemini-3-flash` because:
 * - zero-config in the Vercel AI Gateway
 * - native multi-modal (DOM-tree text + screenshot)
 * - cheap and fast enough for per-step calls
 */
const DEFAULT_MODEL = 'google/gemini-3-flash';

export class LLM {
  readonly cfg: Required<Omit<LLMConfig, 'disabled'>> & { disabled: boolean };

  constructor(cfg: LLMConfig = {}) {
    this.cfg = {
      model: cfg.model ?? DEFAULT_MODEL,
      timeoutMs: cfg.timeoutMs ?? 30_000,
      maxTokens: cfg.maxTokens ?? 1024,
      disabled: cfg.disabled ?? false,
    };
  }

  get enabled(): boolean {
    return !this.cfg.disabled && isLLMAvailable();
  }

  async generateObject<S extends ZodTypeAny>(args: {
    schema: S;
    prompt: string;
    images?: Array<{ data: Buffer | string; mediaType?: string }>;
  }): Promise<z.infer<S>> {
    if (!this.enabled) {
      throw new Error('LLM is disabled or no API key configured (AI_GATEWAY_API_KEY).');
    }
    const messages = [
      {
        role: 'user' as const,
        content: args.images?.length
          ? [
              { type: 'text' as const, text: args.prompt },
              ...args.images.map((img) => ({
                type: 'image' as const,
                image: img.data,
                mediaType: img.mediaType ?? 'image/png',
              })),
            ]
          : args.prompt,
      },
    ];
    const result = await generateObject({
      model: this.cfg.model,
      schema: args.schema,
      messages,
      maxOutputTokens: this.cfg.maxTokens,
      abortSignal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    return result.object as z.infer<S>;
  }

  async generateText(args: { prompt: string; images?: Array<{ data: Buffer | string; mediaType?: string }> }): Promise<string> {
    if (!this.enabled) {
      throw new Error('LLM is disabled or no API key configured.');
    }
    const messages = [
      {
        role: 'user' as const,
        content: args.images?.length
          ? [
              { type: 'text' as const, text: args.prompt },
              ...args.images.map((img) => ({
                type: 'image' as const,
                image: img.data,
                mediaType: img.mediaType ?? 'image/png',
              })),
            ]
          : args.prompt,
      },
    ];
    const result = await generateText({
      model: this.cfg.model,
      messages,
      maxOutputTokens: this.cfg.maxTokens,
      abortSignal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    return result.text;
  }
}
