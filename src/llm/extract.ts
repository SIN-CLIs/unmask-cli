import type { Page } from 'playwright';
import { z, type ZodTypeAny } from 'zod';
import { LLM, type LLMConfig } from './provider.js';
import { serializeForLLM } from './serialize.js';

export interface ExtractOptions extends LLMConfig {
  /** Optional natural language hint describing what to focus on. */
  instruction?: string;
  /** Fetch a screenshot too (multi-modal extraction). Default false. */
  vision?: boolean;
  /** Max characters of page text to send. Default 12_000. */
  maxChars?: number;
}

/**
 * Stagehand-style `extract<T>(schema)` — pulls structured data out of the
 * current page, validated against the supplied Zod schema.
 *
 * Always validates the LLM output through Zod, so callers receive either a
 * typed object or a thrown ZodError — never invalid data.
 */
export async function extract<S extends ZodTypeAny>(
  page: Page,
  schema: S,
  opts: ExtractOptions = {},
): Promise<z.infer<S>> {
  const llm = new LLM(opts);
  if (!llm.enabled) {
    throw new Error(
      'extract() requires an LLM. Set AI_GATEWAY_API_KEY (or another supported provider env var).',
    );
  }
  const tree = await serializeForLLM(page, { limit: 400 });
  const visibleText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  const maxChars = opts.maxChars ?? 12_000;
  const trimmedText = visibleText.slice(0, maxChars);

  const images: Array<{ data: Buffer; mediaType: string }> = [];
  if (opts.vision) {
    const png = await page.screenshot({ type: 'png', fullPage: true });
    images.push({ data: png, mediaType: 'image/png' });
  }

  const result = await llm.generateObject({
    schema,
    prompt: `Extract structured data from the page below.

${opts.instruction ? `Focus: ${opts.instruction}\n` : ''}
URL: ${tree.url}
Title: ${tree.title}

Visible text (truncated):
${trimmedText}

Interactable elements:
${tree.text}

Return data that strictly matches the provided schema.`,
    ...(images.length ? { images } : {}),
  });
  return result;
}
