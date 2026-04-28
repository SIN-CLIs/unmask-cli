/**
 * Sequential Queue Manager (Issue #2).
 *
 * Strict serial processing — one item at a time. Implements the SOTA pattern
 * described in Issue #2:
 *   - "Aggressive Efficiency" / Fast-Switch on disqualification (no pause)
 *   - "Human Pause" 30-60s after a successful run
 *   - "Micro-Jitter" 500-1000ms between every step to avoid race conditions
 *   - Persistent state.json (resumable across crashes / restarts)
 *   - Permanent blacklist (never retry blacklisted IDs)
 *   - Cookie cleanup of the survey domain on disqualification (no full browser
 *     restart, just a navigate-back to the dashboard)
 */
import type { BrowserContext } from 'playwright';
import { humanPause, microJitter } from '../utils/jitter.js';
import { logger } from '../utils/logger.js';
import type { QueueItem, QueueItemStatus, QueueState } from '../schemas/queue.js';
import type { Survey } from '../schemas/unmask.js';
import { StateStore } from './state.js';

export type SurveyOutcome = 'success' | 'disqualified' | 'failed';

export interface SurveyResult {
  outcome: SurveyOutcome;
  error?: string;
  /** When the runner discovered a better selector via self-healing. */
  recoveredSelector?: string;
}

export type SurveyRunner = (
  survey: Survey,
  ctx: { context?: BrowserContext },
) => Promise<SurveyResult>;

export interface QueueManagerOptions {
  store: StateStore;
  /** Optional shared browser context — runner may open its own page. */
  context?: BrowserContext;
  /** Disable the 30-60s human pause after a success (useful in tests). */
  fastMode?: boolean;
  /** Disable the 500-1000ms micro-jitter (useful in tests). */
  noJitter?: boolean;
  /** Cookie-clean origins after a disqualification. Default: derive from URL. */
  cleanupOriginsForDq?: (item: Survey) => string[];
}

export class QueueManager {
  private state: QueueState | null = null;

  constructor(private readonly opts: QueueManagerOptions) {}

  async load(): Promise<QueueState> {
    this.state = await this.opts.store.load();
    return this.state;
  }

  private get s(): QueueState {
    if (!this.state) throw new Error('QueueManager: call load() first');
    return this.state;
  }

  async addSurveys(surveys: Survey[]): Promise<number> {
    const state = this.s;
    const known = new Set(state.items.map((i) => i.survey.id));
    const blacklisted = new Set(state.blacklist);
    let added = 0;
    for (const survey of surveys) {
      if (known.has(survey.id)) continue;
      if (blacklisted.has(survey.id)) continue;
      state.items.push({
        survey,
        status: 'pending',
        attempts: 0,
      });
      added++;
    }
    await this.opts.store.save(state);
    return added;
  }

  async blacklist(ids: string[]): Promise<string[]> {
    const merged = await this.opts.store.appendBlacklist(ids);
    const state = this.s;
    state.blacklist = merged;
    for (const item of state.items) {
      if (merged.includes(item.survey.id) && item.status === 'pending') {
        item.status = 'blacklisted';
      }
    }
    await this.opts.store.save(state);
    return merged;
  }

  async clear(): Promise<void> {
    const state = this.s;
    state.items = [];
    state.cursor = -1;
    state.stats = { processed: 0, success: 0, disqualified: 0, failed: 0 };
    await this.opts.store.save(state);
  }

  async run(runner: SurveyRunner): Promise<QueueState> {
    const state = this.s;

    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i]!;
      if (item.status === 'success' || item.status === 'blacklisted') continue;
      if (state.blacklist.includes(item.survey.id)) {
        item.status = 'blacklisted';
        await this.opts.store.save(state);
        continue;
      }

      state.cursor = i;
      item.status = 'in_progress';
      item.attempts += 1;
      item.startedAt = new Date().toISOString();
      await this.opts.store.save(state);

      logger.info('queue: starting survey', {
        id: item.survey.id,
        attempts: item.attempts,
        cursor: i,
      });

      // Micro-jitter before each step prevents race conditions on rapid
      // sequential clicks (Issue #2 best practice).
      if (!this.opts.noJitter) await microJitter();

      let result: SurveyResult;
      try {
        result = await runner(item.survey, { context: this.opts.context });
      } catch (err) {
        result = { outcome: 'failed', error: (err as Error).message };
      }

      item.finishedAt = new Date().toISOString();

      if (result.recoveredSelector) {
        item.survey.selector = result.recoveredSelector;
      }

      const status = mapOutcomeToStatus(result.outcome);
      item.status = status;
      if (result.error) item.lastError = result.error;
      state.stats.processed++;

      switch (result.outcome) {
        case 'success':
          state.stats.success++;
          await this.opts.store.save(state);
          logger.info('queue: success', { id: item.survey.id });
          if (!this.opts.fastMode) {
            const pauseMs = await humanPause();
            logger.debug('queue: human pause done', { ms: pauseMs });
          }
          break;

        case 'disqualified':
          state.stats.disqualified++;
          await this.opts.store.save(state);
          logger.warn('queue: disqualified — fast switch', { id: item.survey.id });
          await this.cleanupAfterDq(item);
          // No human pause — straight to next.
          break;

        case 'failed':
          state.stats.failed++;
          await this.opts.store.save(state);
          logger.error('queue: failed', { id: item.survey.id, err: result.error });
          // Small jitter, no full pause — next item gets a fresh shot.
          if (!this.opts.noJitter) await microJitter();
          break;
      }
    }

    state.cursor = -1;
    await this.opts.store.save(state);
    return state;
  }

  private async cleanupAfterDq(item: QueueItem): Promise<void> {
    if (!this.opts.context) return;
    const origins = (this.opts.cleanupOriginsForDq?.(item.survey) ?? []).map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0) return;

    try {
      const cookies = await this.opts.context.cookies();
      const keep = cookies.filter((c) => !origins.some((o) => c.domain.includes(o)));
      await this.opts.context.clearCookies();
      if (keep.length > 0) await this.opts.context.addCookies(keep);
      logger.debug('queue: cleared cookies for origins', { origins });
    } catch (err) {
      logger.warn('queue: cookie cleanup failed', { err: (err as Error).message });
    }
  }

  snapshot(): QueueState {
    return this.s;
  }
}

function mapOutcomeToStatus(o: SurveyOutcome): QueueItemStatus {
  switch (o) {
    case 'success':
      return 'success';
    case 'disqualified':
      return 'disqualified';
    case 'failed':
      return 'failed';
  }
}
