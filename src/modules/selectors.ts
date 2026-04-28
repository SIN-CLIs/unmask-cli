/**
 * Self-Healing Selector resolver.
 *
 * Tries a primary selector; on miss, walks an ordered list of fallbacks; on
 * total miss, falls back to a `getByRole` / `getByText` heuristic and finally
 * (when enabled) saves a screenshot of the current viewport so a downstream
 * vision model can recover the element.
 *
 * The recovered selector is reported back to the caller so the queue layer can
 * persist it in state.json as the new "known good" selector.
 */
import type { Locator, Page } from 'playwright';
import { logger } from '../utils/logger.js';

export interface SelfHealOptions {
  primary: string;
  fallbacks?: string[];
  ariaLabel?: string;
  text?: string;
  role?: string;
  timeout?: number;
  /** When true, screenshot the page on full miss for vision-model recovery. */
  screenshotOnMiss?: boolean;
  /** Path the screenshot is written to (when enabled). */
  screenshotPath?: string;
}

export interface SelfHealResult {
  locator: Locator;
  source: 'primary' | 'fallback' | 'role' | 'text';
  matchedSelector: string;
}

export async function selfHeal(page: Page, opts: SelfHealOptions): Promise<SelfHealResult> {
  const timeout = opts.timeout ?? 5_000;
  const tried: string[] = [];

  // 1. Primary
  try {
    const loc = page.locator(opts.primary).first();
    await loc.waitFor({ state: 'visible', timeout });
    return { locator: loc, source: 'primary', matchedSelector: opts.primary };
  } catch {
    tried.push(opts.primary);
  }

  // 2. Fallbacks
  for (const sel of opts.fallbacks ?? []) {
    try {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout: Math.min(timeout, 2_000) });
      logger.warn('selfHeal: primary missed, recovered via fallback', {
        primary: opts.primary,
        fallback: sel,
      });
      return { locator: loc, source: 'fallback', matchedSelector: sel };
    } catch {
      tried.push(sel);
    }
  }

  // 3. Role + accessible name
  if (opts.role) {
    try {
      const loc = page
        .getByRole(opts.role as Parameters<Page['getByRole']>[0], {
          name: opts.ariaLabel ?? opts.text,
        })
        .first();
      await loc.waitFor({ state: 'visible', timeout: Math.min(timeout, 2_000) });
      logger.warn('selfHeal: recovered via role', { role: opts.role, name: opts.ariaLabel });
      return {
        locator: loc,
        source: 'role',
        matchedSelector: `role=${opts.role}[name="${opts.ariaLabel ?? opts.text ?? ''}"]`,
      };
    } catch {
      tried.push(`role=${opts.role}`);
    }
  }

  // 4. Text
  if (opts.text) {
    try {
      const loc = page.getByText(opts.text, { exact: false }).first();
      await loc.waitFor({ state: 'visible', timeout: Math.min(timeout, 2_000) });
      logger.warn('selfHeal: recovered via text', { text: opts.text });
      return { locator: loc, source: 'text', matchedSelector: `text=${opts.text}` };
    } catch {
      tried.push(`text=${opts.text}`);
    }
  }

  if (opts.screenshotOnMiss) {
    const path = opts.screenshotPath ?? `unmask-miss-${Date.now()}.png`;
    try {
      await page.screenshot({ path, fullPage: false });
      logger.error('selfHeal: total miss — screenshot saved for vision recovery', {
        path,
        tried,
      });
    } catch (err) {
      logger.error('selfHeal: screenshot failed', { err: (err as Error).message });
    }
  }

  throw new Error(
    `selfHeal: could not locate element. Tried: ${tried.map((t) => `"${t}"`).join(', ')}`,
  );
}
