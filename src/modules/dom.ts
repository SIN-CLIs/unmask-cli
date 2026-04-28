/**
 * unmask-dom — the "Semantic Scanner".
 *
 * Looks at the DOM by *meaning*, not by IDs or class names that change every
 * release. We score every visible interactive element against a small rule
 * engine: ARIA role, label-like text content, presence of a price token,
 * star ratings, etc. Each candidate gets a confidence score and a primary +
 * fallback selectors so a downstream self-healer can survive small re-designs.
 */
import type { Page } from 'playwright';
import type { DomCandidate } from '../schemas/unmask.js';

export interface DomScannerOptions {
  /** Hard cap on returned candidates. */
  max?: number;
  /** Minimum confidence to include in results (0..1). */
  minConfidence?: number;
}

interface RawCandidate {
  selector: string;
  fallbackSelectors: string[];
  role?: string;
  ariaLabel?: string;
  text?: string;
  visible: boolean;
  bbox?: { x: number; y: number; w: number; h: number };
  reasons: string[];
  confidence: number;
}

export class DomScanner {
  private readonly opts: Required<DomScannerOptions>;

  constructor(opts: DomScannerOptions = {}) {
    this.opts = {
      max: opts.max ?? 50,
      minConfidence: opts.minConfidence ?? 0.2,
    };
  }

  async scan(page: Page): Promise<DomCandidate[]> {
    const raw = await page.evaluate<RawCandidate[]>(() => {
      const PRICE_RE = /(\d+[.,]\d{1,2})\s*(€|EUR|\$|USD|£|GBP)|(€|EUR|\$|USD|£|GBP)\s*(\d+[.,]\d{1,2})/i;
      const DURATION_RE = /(\d+)\s*(min|minute|minutes|sec|seconds|m)\b/i;
      const STAR_HINTS = ['star', 'rating', 'rate'];

      function unique<T>(arr: T[]): T[] {
        return Array.from(new Set(arr));
      }

      function isVisible(el: Element): boolean {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (parseFloat(style.opacity || '1') === 0) return false;
        return true;
      }

      function buildSelector(el: Element): string {
        if ((el as HTMLElement).id) return `#${CSS.escape((el as HTMLElement).id)}`;

        const aria = el.getAttribute('aria-label');
        if (aria) {
          const tag = el.tagName.toLowerCase();
          return `${tag}[aria-label="${aria.replace(/"/g, '\\"')}"]`;
        }
        const role = el.getAttribute('role');
        if (role) {
          const tag = el.tagName.toLowerCase();
          const text = (el.textContent || '').trim().slice(0, 40);
          if (text) return `${tag}[role="${role}"]:has-text("${text.replace(/"/g, '\\"')}")`;
          return `${tag}[role="${role}"]`;
        }
        // Path with nth-of-type fallback
        const path: string[] = [];
        let cur: Element | null = el;
        while (cur && cur.nodeType === 1 && path.length < 6) {
          const node: Element = cur;
          let segment = node.tagName.toLowerCase();
          const parent: Element | null = node.parentElement;
          if (parent) {
            const siblings: Element[] = Array.from(parent.children).filter(
              (c: Element) => c.tagName === node.tagName,
            );
            if (siblings.length > 1) {
              const idx = siblings.indexOf(node) + 1;
              segment += `:nth-of-type(${idx})`;
            }
          }
          path.unshift(segment);
          cur = parent;
        }
        return path.join(' > ');
      }

      function buildFallbacks(el: Element): string[] {
        const out: string[] = [];
        const role = el.getAttribute('role');
        const aria = el.getAttribute('aria-label');
        const text = (el.textContent || '').trim().slice(0, 60);
        const tag = el.tagName.toLowerCase();

        if (aria) out.push(`[aria-label="${aria.replace(/"/g, '\\"')}"]`);
        if (role) out.push(`[role="${role}"]`);
        if (text) out.push(`${tag}:has-text("${text.replace(/"/g, '\\"')}")`);
        const cls = (el as HTMLElement).className;
        if (typeof cls === 'string' && cls.trim()) {
          const first = cls.trim().split(/\s+/)[0];
          if (first) out.push(`${tag}.${CSS.escape(first)}`);
        }
        return unique(out);
      }

      function looksLikeContainer(el: Element): { hits: string[]; score: number } {
        const hits: string[] = [];
        let score = 0;
        const html = el.innerHTML.toLowerCase();
        const text = (el.textContent || '').toLowerCase();

        if (PRICE_RE.test(text)) {
          hits.push('price-text');
          score += 0.35;
        }
        if (DURATION_RE.test(text)) {
          hits.push('duration-text');
          score += 0.15;
        }
        for (const h of STAR_HINTS) {
          if (html.includes(h)) {
            hits.push(`star-hint:${h}`);
            score += 0.1;
            break;
          }
        }

        const buttons = el.querySelectorAll('button, [role="button"], a[href]');
        if (buttons.length > 0) {
          hits.push('has-action');
          score += 0.15;
        }

        if (
          el.querySelector('img,svg') &&
          buttons.length > 0 &&
          (PRICE_RE.test(text) || DURATION_RE.test(text))
        ) {
          hits.push('media+action+number');
          score += 0.15;
        }

        return { hits, score: Math.min(score, 1) };
      }

      const candidates: RawCandidate[] = [];

      // 1. Interactive elements (role-based, ARIA-first).
      const interactive = document.querySelectorAll(
        'button, [role="button"], a[href], [role="link"], [role="listitem"], [data-survey], [data-offer]',
      );
      interactive.forEach((el) => {
        if (!isVisible(el)) return;
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const aria = el.getAttribute('aria-label') || undefined;
        const text = (el.textContent || '').trim().slice(0, 120) || undefined;

        const hits: string[] = [];
        let score = 0.3; // baseline for interactive + visible
        if (aria) {
          hits.push('aria-label');
          score += 0.15;
        }
        if (text && /(start|teilnehmen|begin|jetzt|continue|weiter|join|claim)/i.test(text)) {
          hits.push('action-text');
          score += 0.2;
        }
        if (text && /(\d+[.,]\d{1,2})\s*(€|eur|\$|usd|£|gbp)/i.test(text)) {
          hits.push('price-in-text');
          score += 0.25;
        }

        const r = (el as HTMLElement).getBoundingClientRect();
        candidates.push({
          selector: buildSelector(el),
          fallbackSelectors: buildFallbacks(el),
          role,
          ariaLabel: aria,
          text,
          visible: true,
          bbox: { x: r.x, y: r.y, w: r.width, h: r.height },
          reasons: hits,
          confidence: Math.min(score, 1),
        });
      });

      // 2. Container heuristic: divs/articles/li that look like cards.
      const containers = document.querySelectorAll(
        'article, li, [data-survey], [data-offer], [class*="card"], [class*="item"], [class*="row"]',
      );
      containers.forEach((el) => {
        if (!isVisible(el)) return;
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width < 100 || r.height < 40) return;
        const { hits, score } = looksLikeContainer(el);
        if (score < 0.25) return;

        const text = (el.textContent || '').trim().slice(0, 120) || undefined;
        candidates.push({
          selector: buildSelector(el),
          fallbackSelectors: buildFallbacks(el),
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          ariaLabel: el.getAttribute('aria-label') || undefined,
          text,
          visible: true,
          bbox: { x: r.x, y: r.y, w: r.width, h: r.height },
          reasons: ['container', ...hits],
          confidence: Math.min(score, 1),
        });
      });

      // De-duplicate by selector, keep highest confidence.
      const map = new Map<string, RawCandidate>();
      for (const c of candidates) {
        const prev = map.get(c.selector);
        if (!prev || prev.confidence < c.confidence) {
          map.set(c.selector, c);
        }
      }
      return Array.from(map.values());
    });

    return raw
      .filter((c) => c.confidence >= this.opts.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.opts.max);
  }
}
