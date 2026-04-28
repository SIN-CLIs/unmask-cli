import { z } from 'zod';
import type { Page } from 'playwright';
import { LLM, type LLMConfig } from './provider.js';
import { serializeForLLM } from './serialize.js';
import type { DomCandidate } from '../schemas/unmask.js';

export const ObserveCandidateSchema = z.object({
  rank: z.number().int().nonnegative(),
  selector: z.string(),
  fallbackSelectors: z.array(z.string()).default([]),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  role: z.string().optional(),
  label: z.string().optional(),
});
export type ObserveCandidate = z.infer<typeof ObserveCandidateSchema>;

export interface ObserveOptions extends LLMConfig {
  /** Hard cap on candidates returned. Default 5. */
  topK?: number;
  /** Snap a screenshot and pass it alongside the DOM tree. Default false. */
  vision?: boolean;
}

/**
 * Stagehand-style `observe(intent)` — given a natural-language intent ("the
 * primary CTA", "the email input", "the survey worth most money"), returns
 * a ranked list of candidate elements with stable selectors.
 *
 * Falls back to the DOM heuristic top-K when no LLM API key is configured,
 * so the API is always usable.
 */
export async function observe(
  page: Page,
  intent: string,
  opts: ObserveOptions = {},
): Promise<ObserveCandidate[]> {
  const llm = new LLM(opts);
  const topK = opts.topK ?? 5;
  const tree = await serializeForLLM(page);

  // Heuristic fallback path
  if (!llm.enabled) {
    const sorted = [...tree.index.entries()]
      .sort((a, b) => b[1].confidence - a[1].confidence)
      .slice(0, topK);
    return sorted.map<ObserveCandidate>(([, el], i) => ({
      rank: i,
      selector: el.selector,
      fallbackSelectors: el.fallbackSelectors ?? [],
      reason: el.reasons.join(',') || 'dom-heuristic',
      confidence: el.confidence,
      ...(el.role !== undefined ? { role: el.role } : {}),
      ...((el.ariaLabel ?? el.text) !== undefined ? { label: el.ariaLabel ?? el.text } : {}),
    }));
  }

  const SchemaOut = z.object({
    candidates: z
      .array(
        z.object({
          index: z.number().int().nonnegative(),
          confidence: z.number().min(0).max(1),
          reason: z.string().min(1).max(200),
        }),
      )
      .max(topK),
  });

  const images: Array<{ data: Buffer; mediaType: string }> = [];
  if (opts.vision) {
    const png = await page.screenshot({ type: 'png', fullPage: false });
    images.push({ data: png, mediaType: 'image/png' });
  }

  const result = await llm.generateObject({
    schema: SchemaOut,
    prompt: `You are unmask-cli's observation engine. Pick up to ${topK} elements that best match the user intent.

USER INTENT:
${intent}

PAGE TREE:
${tree.text}

Return ONLY indexes from the list above. Do not invent indexes. Higher confidence = stronger match.`,
    ...(images.length ? { images } : {}),
  });

  return result.candidates
    .filter((c) => tree.index.has(c.index))
    .map<ObserveCandidate>((c, i) => {
      const el: DomCandidate = tree.index.get(c.index)!;
      return {
        rank: i,
        selector: el.selector,
        fallbackSelectors: el.fallbackSelectors ?? [],
        reason: c.reason,
        confidence: c.confidence,
        ...(el.role !== undefined ? { role: el.role } : {}),
        ...((el.ariaLabel ?? el.text) !== undefined ? { label: el.ariaLabel ?? el.text } : {}),
      };
    });
}
