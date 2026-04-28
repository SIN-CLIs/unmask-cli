import type { Page } from 'playwright';
import { DomScanner } from '../modules/dom.js';
import type { DomCandidate } from '../schemas/unmask.js';

export interface SerializedTree {
  url: string;
  title: string;
  /** Compact, line-numbered list usable as LLM context. */
  text: string;
  /** Map from line index back to the original DomCandidate. */
  index: Map<number, DomCandidate>;
}

/**
 * Browser-Use style serializer: produces a numbered list of interactable
 * elements that the LLM can reference by index. A 5000-element page
 * collapses to ~3-8 KB of compact text.
 */
export async function serializeForLLM(
  page: Page,
  opts: { limit?: number; minConfidence?: number } = {},
): Promise<SerializedTree> {
  const limit = opts.limit ?? 200;
  const minConfidence = opts.minConfidence ?? 0.15;
  const scanner = new DomScanner({ max: limit, minConfidence });
  const candidates = await scanner.scan(page);
  const index = new Map<number, DomCandidate>();
  const lines: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i]!;
    index.set(i, el);
    const role = el.role ?? 'el';
    const label = (el.ariaLabel ?? el.text ?? '')
      .slice(0, 80)
      .replace(/\s+/g, ' ')
      .trim();
    const reasons = el.reasons.length ? ` reasons=${el.reasons.slice(0, 3).join(',')}` : '';
    const conf = ` conf=${el.confidence.toFixed(2)}`;
    lines.push(`[${i}] <${role}>${label ? ` "${label}"` : ''}${conf}${reasons}`);
  }
  const url = page.url();
  const title = await page.title().catch(() => '');
  const text = `URL: ${url}\nTitle: ${title}\nElements (${candidates.length}):\n${lines.join('\n')}`;
  return { url, title, text, index };
}
