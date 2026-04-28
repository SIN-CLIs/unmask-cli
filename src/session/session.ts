import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const SessionEventSchema = z.object({
  ts: z.number(),
  kind: z.enum([
    'session.start',
    'session.end',
    'navigate',
    'observe',
    'act',
    'extract',
    'network.request',
    'network.response',
    'console',
    'pageerror',
    'screenshot',
    'error',
    'telemetry',
  ]),
  data: z.record(z.unknown()),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export interface SessionInit {
  id?: string;
  rootDir?: string;
  label?: string;
  meta?: Record<string, unknown>;
}

/**
 * A Session represents one observation run. All artifacts (events JSONL,
 * screenshots, HAR, trace.zip, bundles) are written under the session dir
 * so they can be exported as a single replay bundle (issues #9-#12).
 */
export class Session {
  readonly id: string;
  readonly dir: string;
  readonly screenshotsDir: string;
  readonly eventsFile: string;
  readonly metaFile: string;
  readonly harFile: string;
  readonly traceFile: string;
  readonly startedAt: number;
  private endedAt: number | null = null;
  private writeQueue: Promise<unknown> = Promise.resolve();
  private screenshotIdx = 0;

  constructor(init: SessionInit = {}) {
    this.id = init.id ?? `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const root = init.rootDir ?? join(homedir(), '.unmask', 'sessions');
    this.dir = join(root, this.id);
    this.screenshotsDir = join(this.dir, 'screenshots');
    this.eventsFile = join(this.dir, 'events.jsonl');
    this.metaFile = join(this.dir, 'meta.json');
    this.harFile = join(this.dir, 'network.har');
    this.traceFile = join(this.dir, 'trace.zip');
    this.startedAt = Date.now();
  }

  async init(meta?: Record<string, unknown>): Promise<void> {
    await mkdir(this.screenshotsDir, { recursive: true });
    await writeFile(
      this.metaFile,
      JSON.stringify(
        {
          id: this.id,
          startedAt: this.startedAt,
          ...meta,
        },
        null,
        2,
      ),
    );
    await this.append({ ts: Date.now(), kind: 'session.start', data: { id: this.id } });
  }

  async append(event: SessionEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    this.writeQueue = this.writeQueue.then(async () => {
      const fs = await import('node:fs/promises');
      await fs.appendFile(this.eventsFile, line);
    });
    await this.writeQueue;
  }

  nextScreenshotPath(): string {
    const idx = String(this.screenshotIdx++).padStart(4, '0');
    return join(this.screenshotsDir, `${idx}.png`);
  }

  async end(meta?: Record<string, unknown>): Promise<void> {
    this.endedAt = Date.now();
    await this.append({
      ts: this.endedAt,
      kind: 'session.end',
      data: {
        id: this.id,
        durationMs: this.endedAt - this.startedAt,
        ...meta,
      },
    });
    if (existsSync(this.metaFile)) {
      const current = JSON.parse(await readFile(this.metaFile, 'utf8'));
      current.endedAt = this.endedAt;
      current.durationMs = this.endedAt - this.startedAt;
      Object.assign(current, meta ?? {});
      await writeFile(this.metaFile, JSON.stringify(current, null, 2));
    }
    await this.writeQueue;
  }
}
