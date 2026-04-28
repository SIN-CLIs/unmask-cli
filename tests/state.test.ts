import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StateStore } from '../src/queue/state.js';

describe('StateStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unmask-s-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates a fresh state.json when missing', async () => {
    const s = new StateStore({ dir });
    const state = await s.load();
    expect(state.items).toEqual([]);
    const exists = await fs
      .stat(s.statePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('throws on corrupt JSON', async () => {
    const s = new StateStore({ dir });
    await s.load(); // create
    await fs.writeFile(s.statePath, 'not-json', 'utf8');
    await expect(s.load()).rejects.toThrow(/not valid JSON/);
  });

  it('throws on schema-invalid JSON', async () => {
    const s = new StateStore({ dir });
    await s.load();
    await fs.writeFile(s.statePath, JSON.stringify({ schemaVersion: 99 }), 'utf8');
    await expect(s.load()).rejects.toThrow(/failed validation/);
  });

  it('appendBlacklist deduplicates and merges into state', async () => {
    const s = new StateStore({ dir });
    await s.load();
    const a = await s.appendBlacklist(['x', 'y']);
    const b = await s.appendBlacklist(['y', 'z']);
    expect(new Set(a)).toEqual(new Set(['x', 'y']));
    expect(new Set(b)).toEqual(new Set(['x', 'y', 'z']));

    const reloaded = await s.load();
    expect(new Set(reloaded.blacklist)).toEqual(new Set(['x', 'y', 'z']));
  });
});
