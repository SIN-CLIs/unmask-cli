import type { Page } from 'playwright';
import { z } from 'zod';
import { LLM, type LLMConfig } from './provider.js';
import { observe, type ObserveCandidate } from './observe.js';
import { selfHeal } from '../modules/selectors.js';
import { logger } from '../utils/logger.js';

export const ActVerbSchema = z.enum(['click', 'type', 'select', 'press', 'hover', 'scroll']);
export type ActVerb = z.infer<typeof ActVerbSchema>;

export const ActPlanSchema = z.object({
  verb: ActVerbSchema,
  /** Free-text describing what to act on. Resolved via observe(). */
  target: z.string().min(1),
  value: z.string().optional(),
  reason: z.string().optional(),
});
export type ActPlan = z.infer<typeof ActPlanSchema>;

export interface ActOptions extends LLMConfig {
  /** Vision multi-modal observe(). */
  vision?: boolean;
  /** Per-action timeout. Default 8s. */
  timeout?: number;
  /** Dry-run: resolve target but do not execute. */
  dryRun?: boolean;
}

export interface ActResult {
  ok: boolean;
  candidate?: ObserveCandidate;
  matchedSelector?: string;
  source?: string;
  error?: string;
}

/**
 * Stagehand-style `act(intent)`. Either takes a free-text intent ("click the
 * 'Start survey' button") or a structured ActPlan. Resolves the target via
 * `observe()`, picks the highest-ranked candidate, and executes the verb
 * through the self-healing selector resolver.
 */
export async function act(
  page: Page,
  intent: string | ActPlan,
  opts: ActOptions = {},
): Promise<ActResult> {
  const timeout = opts.timeout ?? 8_000;
  const llm = new LLM(opts);

  const plan: ActPlan = typeof intent === 'string'
    ? llm.enabled
      ? await planFromText(llm, intent)
      : { verb: 'click', target: intent }
    : intent;

  const observeOpts: Parameters<typeof observe>[2] = { topK: 5 };
  if (opts.vision !== undefined) observeOpts.vision = opts.vision;
  if (opts.model !== undefined) observeOpts.model = opts.model;
  const candidates = await observe(page, plan.target, observeOpts);
  if (candidates.length === 0) {
    return { ok: false, error: `No candidate matched intent: ${plan.target}` };
  }
  const best = candidates[0]!;

  if (opts.dryRun) {
    return { ok: true, candidate: best, matchedSelector: best.selector, source: 'dry-run' };
  }

  try {
    const heal = await selfHeal(page, {
      primary: best.selector,
      fallbacks: best.fallbackSelectors,
      ...(best.role !== undefined ? { role: best.role } : {}),
      ...(best.label !== undefined ? { ariaLabel: best.label } : {}),
      timeout,
    });
    switch (plan.verb) {
      case 'click':
        await heal.locator.click({ timeout });
        break;
      case 'type':
        if (plan.value === undefined) throw new Error('act(type) requires `value`');
        await heal.locator.fill(plan.value, { timeout });
        break;
      case 'select':
        if (plan.value === undefined) throw new Error('act(select) requires `value`');
        await heal.locator.selectOption(plan.value, { timeout });
        break;
      case 'press':
        await heal.locator.press(plan.value ?? 'Enter', { timeout });
        break;
      case 'hover':
        await heal.locator.hover({ timeout });
        break;
      case 'scroll':
        await heal.locator.scrollIntoViewIfNeeded({ timeout });
        break;
    }
    logger.info('act: ok', {
      verb: plan.verb,
      target: plan.target,
      matched: heal.matchedSelector,
      source: heal.source,
    });
    return { ok: true, candidate: best, matchedSelector: heal.matchedSelector, source: heal.source };
  } catch (err) {
    return { ok: false, candidate: best, error: (err as Error).message };
  }
}

async function planFromText(llm: LLM, text: string): Promise<ActPlan> {
  return llm.generateObject({
    schema: ActPlanSchema,
    prompt: `Convert the natural-language instruction into a structured action plan.

Instruction: "${text}"

Pick the most reasonable verb. If unclear, default to "click" with the instruction text as target. Only output JSON matching the schema.`,
  });
}
