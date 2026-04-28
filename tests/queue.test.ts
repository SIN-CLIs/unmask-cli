import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueueManager } from '../src/queue/manager.js';
import { StateStore } from '../src/queue/state.js';
import type { Survey } from '../src/schemas/unmask.js';

function survey(id: string, amount = 0.5): Survey {
  return {
    id,
    reward: { amount, currency: 'EUR' },
    confidence: 0.9,
    selector: `#${id}`,
    fallbackSelectors: [],
    actionType: 'click',
  };
}

describe('QueueManager', () => {
  let dir: string;
  let store: StateStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unmask-q-'));
    store = new StateStore({ dir });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('persists state.json across instances', async () => {
    const a = new QueueManager({ store });
    await a.load();
    await a.addSurveys([survey('s1'), survey('s2')]);

    const b = new QueueManager({ store: new StateStore({ dir }) });
    const state = await b.load();
    expect(state.items.map((i) => i.survey.id)).toEqual(['s1', 's2']);
  });

  it('blacklist prevents re-add and marks pending items', async () => {
    const m = new QueueManager({ store });
    await m.load();
    await m.addSurveys([survey('s1'), survey('s2')]);
    await m.blacklist(['s1', 'sX']);
    const state = m.snapshot();
    expect(state.blacklist).toContain('s1');
    expect(state.blacklist).toContain('sX');
    const s1 = state.items.find((i) => i.survey.id === 's1');
    expect(s1?.status).toBe('blacklisted');

    // Re-adding s1 has no effect.
    const added = await m.addSurveys([survey('s1'), survey('s3')]);
    expect(added).toBe(1);
    expect(m.snapshot().items.find((i) => i.survey.id === 's3')).toBeDefined();
  });

  it('runs strictly sequentially and updates stats', async () => {
    const m = new QueueManager({ store, fastMode: true, noJitter: true });
    await m.load();
    await m.addSurveys([survey('a'), survey('b'), survey('c')]);

    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const final = await m.run(async (s) => {
      active++;
      maxActive = Math.max(maxActive, active);
      // Simulate async work but never overlap.
      await new Promise((r) => setTimeout(r, 5));
      order.push(s.id);
      active--;
      if (s.id === 'b') return { outcome: 'disqualified' };
      if (s.id === 'c') return { outcome: 'failed', error: 'boom' };
      return { outcome: 'success' };
    });

    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxActive).toBe(1); // strict sequential guarantee
    expect(final.stats.processed).toBe(3);
    expect(final.stats.success).toBe(1);
    expect(final.stats.disqualified).toBe(1);
    expect(final.stats.failed).toBe(1);
    expect(final.cursor).toBe(-1);
  });

  it('records recoveredSelector from runner', async () => {
    const m = new QueueManager({ store, fastMode: true, noJitter: true });
    await m.load();
    await m.addSurveys([survey('z')]);
    const final = await m.run(async () => ({
      outcome: 'success',
      recoveredSelector: '[role="button"][aria-label="Start"]',
    }));
    expect(final.items[0]!.survey.selector).toBe('[role="button"][aria-label="Start"]');
  });

  it('appends to blacklist file persistently', async () => {
    const m = new QueueManager({ store });
    await m.load();
    await m.blacklist(['a', 'b']);
    await m.blacklist(['b', 'c']);
    const raw = await fs.readFile(store.blacklistPath, 'utf8');
    const ids = JSON.parse(raw);
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c']));
  });
});
