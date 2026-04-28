import { describe, expect, it } from 'vitest';
import { jitterMs, microJitter, randomInt, sleep } from '../src/utils/jitter.js';

describe('jitter', () => {
  it('randomInt stays within bounds', () => {
    for (let i = 0; i < 200; i++) {
      const v = randomInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('jitterMs honours the requested range', () => {
    for (let i = 0; i < 50; i++) {
      const v = jitterMs({ min: 100, max: 200 });
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThanOrEqual(200);
    }
  });

  it('microJitter waits between 500 and 1000ms', async () => {
    const started = Date.now();
    const ms = await microJitter();
    const elapsed = Date.now() - started;
    expect(ms).toBeGreaterThanOrEqual(500);
    expect(ms).toBeLessThanOrEqual(1000);
    // Allow some scheduling slop on slow runners.
    expect(elapsed).toBeGreaterThanOrEqual(490);
  });

  it('sleep(0) resolves immediately', async () => {
    const t = Date.now();
    await sleep(0);
    expect(Date.now() - t).toBeLessThan(20);
  });
});
