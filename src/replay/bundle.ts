import { createWriteStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import archiver from 'archiver';

/**
 * Single-file replay bundle (issue #12). Zips a session directory into one
 * shareable archive: events.jsonl + meta.json + screenshots/ + network.har +
 * trace.zip if present.
 */
export async function bundleSession(sessionDir: string, out?: string): Promise<string> {
  if (!existsSync(sessionDir)) {
    throw new Error(`Session directory not found: ${sessionDir}`);
  }
  const target = out ?? `${sessionDir}.bundle.zip`;
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(target);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));
    archive.pipe(output);
    archive.directory(sessionDir, false);
    void archive.finalize();
  });
  const sz = await stat(target);
  return `${target} (${sz.size} bytes)`;
}

export function sessionArtifactPaths(sessionDir: string): {
  events: string;
  meta: string;
  har: string;
  trace: string;
  screenshots: string;
} {
  return {
    events: join(sessionDir, 'events.jsonl'),
    meta: join(sessionDir, 'meta.json'),
    har: join(sessionDir, 'network.har'),
    trace: join(sessionDir, 'trace.zip'),
    screenshots: join(sessionDir, 'screenshots'),
  };
}
