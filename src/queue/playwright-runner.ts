import type { BrowserContext, Page } from 'playwright';
import { selfHeal } from '../modules/selectors.js';
import type { Survey } from '../schemas/unmask.js';
import type { SurveyResult, SurveyRunner } from './manager.js';
import { logger } from '../utils/logger.js';

export interface PlaywrightRunnerOptions {
  /** Domains whose visit, in the post-survey URL, signals a disqualification. */
  disqualificationHosts?: string[];
  /** Substrings whose appearance in `document.body.innerText` signals dq. */
  disqualificationTexts?: string[];
  /** Substrings indicating a successful completion (default: a few common ones). */
  successTexts?: string[];
  /** Per-survey timeout in ms (default 60s). */
  timeout?: number;
  /** Optional hook to verify success by sniffing network captures. */
  verifySuccess?: (page: Page) => Promise<boolean>;
  /** Reuse a single page across all surveys (default true). */
  reusePage?: boolean;
}

const DEFAULT_DQ_TEXTS = [
  'do not qualify',
  'nicht qualifiziert',
  'no longer eligible',
  'better luck next time',
];

const DEFAULT_SUCCESS_TEXTS = [
  'thank you for completing',
  'vielen dank für ihre teilnahme',
  'congratulations',
];

/**
 * Default self-healing runner used by `unmask queue run` (issue #20).
 * - Resolves the survey selector via `selfHeal()` so DOM drift is recovered
 *   and the recovered selector is reported back to the QueueManager for
 *   persistent state.json updates.
 * - Detects success / dq via configurable text heuristics or a custom hook.
 */
export function createPlaywrightSurveyRunner(
  context: BrowserContext,
  opts: PlaywrightRunnerOptions = {},
): SurveyRunner {
  const reuse = opts.reusePage ?? true;
  let sharedPage: Page | null = null;
  const timeout = opts.timeout ?? 60_000;
  const dqTexts = (opts.disqualificationTexts ?? DEFAULT_DQ_TEXTS).map((t) => t.toLowerCase());
  const successTexts = (opts.successTexts ?? DEFAULT_SUCCESS_TEXTS).map((t) => t.toLowerCase());

  return async (survey: Survey): Promise<SurveyResult> => {
    const page: Page = reuse
      ? sharedPage ?? (sharedPage = await context.newPage())
      : await context.newPage();

    try {
      const heal = await selfHeal(page, {
        primary: survey.selector,
        fallbacks: survey.fallbackSelectors ?? [],
        ...(survey.semantic?.role !== undefined ? { role: survey.semantic.role } : {}),
        ...(survey.semantic?.ariaLabel !== undefined
          ? { ariaLabel: survey.semantic.ariaLabel }
          : {}),
        ...(survey.semantic?.text !== undefined ? { text: survey.semantic.text } : {}),
        timeout,
        screenshotOnMiss: true,
      });

      switch (survey.actionType) {
        case 'click':
        case 'js_click':
          await heal.locator.click({ timeout });
          break;
        case 'navigate': {
          const href = await heal.locator.getAttribute('href');
          if (href) await page.goto(href, { waitUntil: 'domcontentloaded' });
          break;
        }
        case 'form':
          await heal.locator.click({ timeout });
          break;
      }

      // Wait for some kind of nav settle
      await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});

      // Outcome detection
      const url = page.url();
      const text = (await page.evaluate(() => document.body?.innerText ?? '')).toLowerCase();
      if (opts.disqualificationHosts?.some((h) => url.includes(h))) {
        return outcome('disqualified', heal.matchedSelector, survey.selector);
      }
      if (dqTexts.some((t) => text.includes(t))) {
        return outcome('disqualified', heal.matchedSelector, survey.selector);
      }
      if (opts.verifySuccess) {
        const ok = await opts.verifySuccess(page).catch(() => false);
        if (ok) return outcome('success', heal.matchedSelector, survey.selector);
      }
      if (successTexts.some((t) => text.includes(t))) {
        return outcome('success', heal.matchedSelector, survey.selector);
      }
      // Ambiguous: treat as success if click was clean
      logger.debug('runner: outcome ambiguous, defaulting to success', { id: survey.id });
      return outcome('success', heal.matchedSelector, survey.selector);
    } catch (err) {
      return { outcome: 'failed', error: (err as Error).message };
    } finally {
      if (!reuse) {
        await page.close().catch(() => {});
      }
    }
  };
}

function outcome(
  o: 'success' | 'disqualified' | 'failed',
  matched: string,
  primary: string,
): SurveyResult {
  const result: SurveyResult = { outcome: o };
  if (matched && matched !== primary) {
    result.recoveredSelector = matched;
  }
  return result;
}
