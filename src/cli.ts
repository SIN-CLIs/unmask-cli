#!/usr/bin/env node
/**
 * unmask-cli — entry point.
 *
 *   unmask inspect <url>           Run all three modules and emit JSON
 *   unmask network <url>           Only the network sniffer
 *   unmask dom     <url>           Only the semantic DOM scan
 *   unmask console <url>           Only the console listener
 *   unmask queue <subcommand>      Sequential queue (Issue #2)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { inspect } from './commands/inspect.js';
import { ConsoleListener } from './modules/console.js';
import { DomScanner } from './modules/dom.js';
import { NetworkSniffer } from './modules/network.js';
import { launchBrowser } from './browser/runner.js';
import { QueueManager } from './queue/manager.js';
import { StateStore } from './queue/state.js';
import { logger } from './utils/logger.js';
import { SurveySchema, type Survey } from './schemas/unmask.js';

const program = new Command();

program
  .name('unmask')
  .description(
    'X-ray vision for web automation agents — CDP network sniffing, semantic DOM analysis, console listening and sequential queue processing.',
  )
  .version('0.1.0');

program
  .option('--json-logs', 'emit logs as JSON to stderr', false)
  .option('--silent', 'suppress all log output', false)
  .option('--log-level <level>', 'one of debug|info|warn|error', 'info')
  .hook('preAction', (thisCommand) => {
    const o = thisCommand.opts();
    if (o.silent) logger.setSilent(true);
    if (o.jsonLogs) logger.setJson(true);
    if (typeof o.logLevel === 'string') {
      const lvl = o.logLevel as 'debug' | 'info' | 'warn' | 'error';
      logger.setLevel(lvl);
    }
  });

// ---- inspect ----------------------------------------------------------------
program
  .command('inspect')
  .description('Run all modules (network + dom + console) on a URL and print JSON.')
  .argument('<url>', 'Page URL to inspect')
  .option('--headful', 'launch a visible browser', false)
  .option('--wait-selector <sel>', 'wait until this CSS selector is visible')
  .option('--wait-ms <ms>', 'extra wait after navigation in ms', '0')
  .option('--only-matched-network', 'only return network captures with keyword hits', false)
  .option('--screenshot <path>', 'save a full-page screenshot to this path')
  .option('--stealth', 'apply built-in stealth patches', false)
  .option('-o, --output <path>', 'write JSON to this path instead of stdout')
  .action(async (url: string, opts) => {
    const out = await inspect({
      url,
      headless: !opts.headful,
      waitForSelector: opts.waitSelector,
      waitMs: Number(opts.waitMs) || 0,
      onlyMatchedNetwork: Boolean(opts.onlyMatchedNetwork),
      screenshotPath: opts.screenshot,
      stealth: Boolean(opts.stealth),
    });
    await emit(out, opts.output);
  });

// ---- network ----------------------------------------------------------------
program
  .command('network')
  .description('CDP-based JSON sniffer (unmask-network).')
  .argument('<url>', 'Page URL to sniff')
  .option('--headful', 'launch a visible browser', false)
  .option('--wait-ms <ms>', 'extra wait after navigation in ms', '5000')
  .option('--only-matched', 'only return captures with keyword hits', false)
  .option('-o, --output <path>', 'write JSON to this path instead of stdout')
  .action(async (url: string, opts) => {
    const handle = await launchBrowser({ headless: !opts.headful });
    const sniffer = new NetworkSniffer({ onlyMatched: Boolean(opts.onlyMatched) });
    try {
      await sniffer.attach(handle.page);
      await handle.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await handle.page.waitForTimeout(Number(opts.waitMs) || 5_000);
      await emit(sniffer.results(), opts.output);
    } finally {
      await sniffer.detach();
      await handle.close();
    }
  });

// ---- dom --------------------------------------------------------------------
program
  .command('dom')
  .description('Semantic DOM scanner (unmask-dom).')
  .argument('<url>', 'Page URL to scan')
  .option('--headful', 'launch a visible browser', false)
  .option('--wait-ms <ms>', 'extra wait after navigation in ms', '2000')
  .option('--min-confidence <n>', 'drop candidates below this score (0..1)', '0.2')
  .option('-o, --output <path>', 'write JSON to this path instead of stdout')
  .action(async (url: string, opts) => {
    const handle = await launchBrowser({ headless: !opts.headful });
    try {
      await handle.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await handle.page.waitForTimeout(Number(opts.waitMs) || 2_000);
      const scanner = new DomScanner({ minConfidence: Number(opts.minConfidence) });
      const candidates = await scanner.scan(handle.page);
      await emit(candidates, opts.output);
    } finally {
      await handle.close();
    }
  });

// ---- console ----------------------------------------------------------------
program
  .command('console')
  .description('Live console listener (unmask-console).')
  .argument('<url>', 'Page URL to listen to')
  .option('--headful', 'launch a visible browser', false)
  .option('--wait-ms <ms>', 'how long to listen after navigation in ms', '8000')
  .option('-o, --output <path>', 'write JSON to this path instead of stdout')
  .action(async (url: string, opts) => {
    const handle = await launchBrowser({ headless: !opts.headful });
    const listener = new ConsoleListener();
    try {
      listener.attach(handle.page);
      await handle.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await handle.page.waitForTimeout(Number(opts.waitMs) || 8_000);
      await emit(listener.results(), opts.output);
    } finally {
      await handle.close();
    }
  });

// ---- queue ------------------------------------------------------------------
const queue = program.command('queue').description('Sequential queue worker (Issue #2).');

queue
  .command('add')
  .description('Add surveys to the queue from a JSON file (array of Survey objects).')
  .argument('<file>', 'JSON file containing Survey[]')
  .option('--state-dir <dir>', 'directory for state.json/blacklist.json', '.unmask')
  .action(async (file: string, opts) => {
    const raw = await fs.readFile(path.resolve(file), 'utf8');
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : (data?.surveys ?? []);
    const surveys: Survey[] = arr.map((x: unknown) => SurveySchema.parse(x));
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({ store });
    await qm.load();
    const added = await qm.addSurveys(surveys);
    await emit({ added, total: qm.snapshot().items.length });
  });

queue
  .command('list')
  .description('Print current queue state.')
  .option('--state-dir <dir>', 'directory for state.json/blacklist.json', '.unmask')
  .action(async (opts) => {
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({ store });
    const state = await qm.load();
    await emit(state);
  });

queue
  .command('blacklist')
  .description('Append IDs to the persistent blacklist.')
  .argument('<ids...>', 'survey IDs to blacklist')
  .option('--state-dir <dir>', 'directory for state.json/blacklist.json', '.unmask')
  .action(async (ids: string[], opts) => {
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({ store });
    await qm.load();
    const merged = await qm.blacklist(ids);
    await emit({ blacklist: merged });
  });

queue
  .command('clear')
  .description('Reset the queue (keeps blacklist).')
  .option('--state-dir <dir>', 'directory for state.json/blacklist.json', '.unmask')
  .action(async (opts) => {
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({ store });
    await qm.load();
    await qm.clear();
    await emit({ ok: true });
  });

queue
  .command('run')
  .description(
    'Run the queue strictly sequentially. Without a custom runner this performs a "dry-run" simulation that exercises the full state machine.',
  )
  .option('--state-dir <dir>', 'directory for state.json/blacklist.json', '.unmask')
  .option('--fast-mode', 'skip the human pause between successes (testing only)', false)
  .option('--no-jitter', 'skip the 500-1000ms micro-jitter between steps', false)
  .option(
    '--simulate <outcome>',
    'simulate every item with the given outcome (success|disqualified|failed|mixed)',
    'mixed',
  )
  .action(async (opts) => {
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({
      store,
      fastMode: Boolean(opts.fastMode),
      noJitter: opts.jitter === false,
    });
    await qm.load();

    const sim = String(opts.simulate);
    const final = await qm.run(async (survey, _ctx) => {
      let outcome: 'success' | 'disqualified' | 'failed';
      if (sim === 'success' || sim === 'disqualified' || sim === 'failed') outcome = sim;
      else outcome = pickMixed(survey.id);
      return { outcome };
    });
    await emit(final);
  });

// -----------------------------------------------------------------------------

function pickMixed(seed: string): 'success' | 'disqualified' | 'failed' {
  // Deterministic per id so re-runs produce the same demo results.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = h % 100;
  if (r < 60) return 'success';
  if (r < 90) return 'disqualified';
  return 'failed';
}

async function emit(payload: unknown, output?: string): Promise<void> {
  const json = JSON.stringify(payload, null, 2);
  if (output) {
    await fs.writeFile(path.resolve(output), json + '\n', 'utf8');
    logger.info('wrote output', { path: path.resolve(output), bytes: json.length });
    return;
  }
  process.stdout.write(json + '\n');
}

program.parseAsync(process.argv).catch((err: Error) => {
  logger.error('fatal', { err: err.message, stack: err.stack });
  process.exitCode = 1;
});
