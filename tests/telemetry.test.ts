import { describe, it, expect } from 'vitest';
import { Telemetry } from '../src/queue/telemetry.js';

const survey = (id: string, amount: number, currency = 'EUR') => ({
  survey: {
    id,
    reward: { amount, currency },
    confidence: 0.9,
    selector: '#x',
    fallbackSelectors: [],
    actionType: 'click' as const,
  },
});

describe('Telemetry', () => {
  it('aggregates simple stats', () => {
    const t = new Telemetry();
    t.recordResult(survey('a', 1.0), 'success', 60_000);
    t.recordResult(survey('b', 0.5), 'success', 30_000);
    t.recordResult(survey('c', 2.0), 'failed', 10_000);
    const s = t.summary();
    expect(s.successes).toBe(2);
    expect(s.failures).toBe(1);
    expect(s.totalRewardEUR).toBeCloseTo(1.5, 2);
    expect(s.successRate).toBeCloseTo(2 / 3, 2);
    // 1.50 EUR earned in 90s of successful work => 60.00 EUR/h
    expect(s.effectiveEurPerHour).toBeCloseTo(60, 0);
  });

  it('handles non-EUR currencies via static rates', () => {
    const t = new Telemetry();
    t.recordResult(survey('a', 1.0, 'USD'), 'success', 60_000);
    expect(t.summary().totalRewardEUR).toBeGreaterThan(0.5);
    expect(t.summary().totalRewardEUR).toBeLessThan(1.0);
  });

  it('serialises samples to JSONL', () => {
    const t = new Telemetry();
    t.recordResult(survey('a', 1.0), 'success', 5_000);
    const lines = t.toJSONL().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.itemId).toBe('a');
    expect(parsed.status).toBe('success');
  });

  it('treats only completed items as the success-rate denominator', () => {
    const t = new Telemetry();
    t.recordResult(survey('a', 1.0), 'success', 60_000);
    t.recordResult(survey('b', 1.0), 'skipped', 0);
    const s = t.summary();
    expect(s.skipped).toBe(1);
    expect(s.successRate).toBe(1); // 1 success / 1 completed
  });
});
