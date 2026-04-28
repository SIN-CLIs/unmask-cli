import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Session } from '../src/session/session.js';
import { bundleSession, sessionArtifactPaths } from '../src/replay/bundle.js';

describe('replay bundle', () => {
  it('zips a session directory into a single archive', async () => {
    const root = await mkdtemp(join(tmpdir(), 'unmask-bundle-'));
    const s = new Session({ rootDir: root });
    await s.init({ note: 'test' });
    await s.append({ ts: Date.now(), kind: 'navigate', data: { url: 'https://x' } });
    await mkdir(s.screenshotsDir, { recursive: true });
    await writeFile(join(s.screenshotsDir, '0001.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await s.end();

    const result = await bundleSession(s.dir);
    expect(result).toMatch(/bundle\.zip/);
    const m = result.match(/\((\d+) bytes\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(0);

    const paths = sessionArtifactPaths(s.dir);
    const evstat = await stat(paths.events);
    expect(evstat.size).toBeGreaterThan(0);
  });
});
