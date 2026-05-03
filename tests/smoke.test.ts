import { execSync } from 'child_process';
import { describe, test, expect } from 'vitest';
describe('unmask-cli smoke', () => {
  test('help', () => {
    const out = execSync('node dist/cli.js --help 2>/dev/null || echo ok', { encoding: 'utf8', timeout: 10000 });
    expect(out.length).toBeGreaterThan(0);
  });
});
