#!/usr/bin/env node
// Postinstall hook: ensure a Chromium binary exists for Playwright (issue #18).
// Skipped in CI (browsers usually cached) and skippable via UNMASK_SKIP_POSTINSTALL=1.
import { spawnSync } from 'node:child_process';

if (process.env.UNMASK_SKIP_POSTINSTALL === '1' || process.env.npm_config_unmask_skip_postinstall === '1') {
  process.stdout.write('[unmask-cli] postinstall skipped (UNMASK_SKIP_POSTINSTALL=1)\n');
  process.exit(0);
}

if (process.env.CI && !process.env.UNMASK_FORCE_POSTINSTALL) {
  process.stdout.write('[unmask-cli] postinstall skipped (CI=1; rely on actions/cache for browsers)\n');
  process.exit(0);
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'install', '--with-deps', 'chromium'];
process.stdout.write(`[unmask-cli] running: ${cmd} ${args.join(' ')}\n`);
const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
if (result.status !== 0) {
  process.stderr.write(
    '[unmask-cli] WARN: failed to install Playwright Chromium automatically. Run `npx playwright install chromium` manually.\n',
  );
  // Do not fail the npm install; the package itself is still importable.
  process.exit(0);
}
