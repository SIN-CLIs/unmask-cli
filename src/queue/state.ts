/**
 * Persistent queue state on disk (state.json + blacklist.json).
 *
 * Atomic writes via temp-file + rename so a crash mid-write cannot corrupt
 * the file. Schema validation on load via Zod so an old / hand-edited file
 * surfaces a clear error instead of silently misbehaving.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { QueueStateSchema, emptyQueueState, type QueueState } from '../schemas/queue.js';
import { logger } from '../utils/logger.js';

export interface StateStoreOptions {
  /** Directory where state files live. Default: ./.unmask */
  dir?: string;
  /** Filename for the queue state. Default: state.json */
  stateFile?: string;
  /** Filename for the blacklist. Default: blacklist.json */
  blacklistFile?: string;
}

export class StateStore {
  readonly dir: string;
  readonly statePath: string;
  readonly blacklistPath: string;

  constructor(opts: StateStoreOptions = {}) {
    this.dir = path.resolve(opts.dir ?? '.unmask');
    this.statePath = path.join(this.dir, opts.stateFile ?? 'state.json');
    this.blacklistPath = path.join(this.dir, opts.blacklistFile ?? 'blacklist.json');
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async load(): Promise<QueueState> {
    await this.ensureDir();
    let raw: string;
    try {
      raw = await fs.readFile(this.statePath, 'utf8');
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        const fresh = emptyQueueState();
        await this.save(fresh);
        return fresh;
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`StateStore: state.json is not valid JSON: ${(err as Error).message}`);
    }
    try {
      const state = QueueStateSchema.parse(parsed);
      // Merge blacklist file (the queue subcommand's `--blacklist` writes here).
      const bl = await this.loadBlacklist();
      state.blacklist = Array.from(new Set([...(state.blacklist ?? []), ...bl]));
      return state;
    } catch (err) {
      if (err instanceof ZodError) {
        throw new Error(`StateStore: state.json failed validation: ${err.message}`);
      }
      throw err;
    }
  }

  async save(state: QueueState): Promise<void> {
    await this.ensureDir();
    state.updatedAt = new Date().toISOString();
    QueueStateSchema.parse(state); // throw early if we're persisting garbage
    const tmp = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, this.statePath);
  }

  async loadBlacklist(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.blacklistPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter((x): x is string => typeof x === 'string');
      if (Array.isArray((data as { ids?: unknown[] }).ids)) {
        return (data as { ids: unknown[] }).ids.filter((x): x is string => typeof x === 'string');
      }
      return [];
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return [];
      logger.warn('StateStore: failed to read blacklist', { err: (err as Error).message });
      return [];
    }
  }

  async appendBlacklist(ids: string[]): Promise<string[]> {
    const existing = await this.loadBlacklist();
    const merged = Array.from(new Set([...existing, ...ids.filter(Boolean)]));
    await this.ensureDir();
    const tmp = `${this.blacklistPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(merged, null, 2), 'utf8');
    await fs.rename(tmp, this.blacklistPath);
    return merged;
  }
}
