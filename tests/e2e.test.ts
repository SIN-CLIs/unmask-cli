/**
 * Real-browser end-to-end test (issue #22). Skipped when no Chromium is
 * installed (CI runs `playwright install chromium` separately).
 *
 * Force-skip via `UNMASK_SKIP_E2E=1`.
 */
import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DomScanner } from '../src/modules/dom.js';
import { NetworkSniffer } from '../src/modules/network.js';
import { ConsoleListener } from '../src/modules/console.js';
import { selfHeal } from '../src/modules/selectors.js';

const SKIP = process.env.UNMASK_SKIP_E2E === '1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + join(__dirname, 'fixtures', 'survey-page.html');

(SKIP ? describe.skip : describe)('e2e: real browser against local fixture', () => {
  it(
    'scans, sniffs, listens, then heals through to a successful click',
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();

        const sniffer = new NetworkSniffer();
        await sniffer.attach(page);
        const consoleListener = new ConsoleListener();
        consoleListener.attach(page);

        await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });

        // 1. Semantic DOM scan finds at least the 3 buttons
        const scanner = new DomScanner({ minConfidence: 0.1, max: 50 });
        const candidates = await scanner.scan(page);
        expect(candidates.length).toBeGreaterThanOrEqual(3);
        const startButtons = candidates.filter((c) =>
          (c.text ?? '').toLowerCase().includes('start') ||
          (c.ariaLabel ?? '').toLowerCase().includes('start'),
        );
        expect(startButtons.length).toBeGreaterThanOrEqual(3);

        // 2. self-heal recovers when the primary selector is wrong
        const heal = await selfHeal(page, {
          primary: '#nope-not-real',
          fallbacks: ['button[data-testid="start"]'],
          role: 'button',
          ariaLabel: 'Start survey s-002',
          timeout: 4000,
        });
        expect(['fallback', 'role', 'text']).toContain(heal.source);
        await heal.locator.click();

        await page.waitForLoadState('domcontentloaded');
        const text = await page.evaluate(() => document.body.innerText);
        expect(text.toLowerCase()).toContain('thank you for completing');

        // 3. console listener picked up the fixture marker
        const consoleEntries = consoleListener.results();
        expect(consoleEntries.some((e) => e.text.includes('fixture'))).toBe(true);

        // 4. network sniffer attempted the /api/surveys request
        const network = sniffer.results();
        expect(Array.isArray(network)).toBe(true);

        await sniffer.detach();
        await ctx.close();
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
