import type { QueueItem } from '../schemas/queue.js';

export interface TelemetrySample {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  rewardEUR: number;
  durationMs: number;
  startedAt: number;
  endedAt: number;
}

export interface TelemetrySummary {
  totalItems: number;
  successes: number;
  failures: number;
  skipped: number;
  successRate: number;
  totalRewardEUR: number;
  totalDurationMs: number;
  /** Effective EUR/hour, computed only over the time spent on successful runs. */
  effectiveEurPerHour: number;
  /** Average reward per successful item. */
  avgRewardEUR: number;
  /** Median item duration in ms (over all completed). */
  medianDurationMs: number;
  startedAt: number;
  endedAt: number;
}

export class Telemetry {
  private readonly samples: TelemetrySample[] = [];
  private readonly startedAt = Date.now();

  recordResult(
    item: Pick<QueueItem, 'survey'>,
    status: TelemetrySample['status'],
    durationMs: number,
  ): void {
    const reward = toEuros(item.survey.reward);
    const endedAt = Date.now();
    this.samples.push({
      itemId: item.survey.id,
      status,
      rewardEUR: reward,
      durationMs,
      startedAt: endedAt - durationMs,
      endedAt,
    });
  }

  summary(): TelemetrySummary {
    const endedAt = Date.now();
    const successes = this.samples.filter((s) => s.status === 'success').length;
    const failures = this.samples.filter((s) => s.status === 'failed').length;
    const skipped = this.samples.filter((s) => s.status === 'skipped').length;
    const successSamples = this.samples.filter((s) => s.status === 'success');
    const totalRewardEUR = successSamples.reduce((acc, s) => acc + s.rewardEUR, 0);
    const successDurationMs = successSamples.reduce((acc, s) => acc + s.durationMs, 0);
    const totalDurationMs = endedAt - this.startedAt;
    const completed = this.samples.filter((s) => s.status !== 'skipped');
    const sortedDurations = [...completed.map((s) => s.durationMs)].sort((a, b) => a - b);
    const median = sortedDurations.length === 0
      ? 0
      : sortedDurations[Math.floor(sortedDurations.length / 2)] ?? 0;
    const successRate = completed.length === 0 ? 0 : successes / completed.length;
    const effectiveEurPerHour =
      successDurationMs === 0 ? 0 : (totalRewardEUR / successDurationMs) * 3_600_000;
    return {
      totalItems: this.samples.length,
      successes,
      failures,
      skipped,
      successRate,
      totalRewardEUR,
      totalDurationMs,
      effectiveEurPerHour,
      avgRewardEUR: successes === 0 ? 0 : totalRewardEUR / successes,
      medianDurationMs: median,
      startedAt: this.startedAt,
      endedAt,
    };
  }

  /** Newline-delimited JSON of every sample, suitable for piping to a log file. */
  toJSONL(): string {
    return this.samples.map((s) => JSON.stringify(s)).join('\n');
  }
}

function toEuros(reward: { amount: number; currency: string }): number {
  if (reward.currency === 'EUR') return reward.amount;
  // Conservative static fallback rates; better than dropping the data.
  const rates: Record<string, number> = {
    USD: 0.92,
    GBP: 1.17,
    CHF: 1.04,
    PLN: 0.23,
  };
  const rate = rates[reward.currency] ?? 1;
  return reward.amount * rate;
}
