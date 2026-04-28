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
import { homedir } from 'node:os';
import { Command } from 'commander';
import { inspect } from './commands/inspect.js';
import { DomScanner } from './modules/dom.js';
import { NetworkSniffer } from './modules/network.js';
import { launchBrowser } from './browser/runner.js';
import { QueueManager } from './queue/manager.js';
import { StateStore } from './queue/state.js';
import { Telemetry } from './queue/telemetry.js';
import { logger } from './utils/logger.js';
import { Notifier } from './utils/notify.js';
import { SurveySchema, type Survey } from './schemas/unmask.js';
import { runStdioServer } from './ipc/stdio.js';
import { runHttpServer } from './ipc/http.js';
import { bundleSession } from './replay/bundle.js';
import { isLLMAvailable } from './llm/provider.js';

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

// ---- survey (X-ray for playstealth-cli) -------------------------------------
const survey = program
  .command("survey")
  .description("Survey page analysis for playstealth-cli integration.");

survey
  .command("scan")
  .description("Full survey page scan: panel, traps, reward, risk, questions.")
  .argument("<url>", "Survey page URL")
  .option("--headful", "launch a visible browser", false)
  .option("--json", "output JSON only", false)
  .action(async (url: string, opts: Record<string, string>) => {
    const { launchBrowser } = await import("./browser/runner.js");
    const { PanelDetector } = await import(
      "./modules/survey/panel-detector.js"
    );
    const { TrapScanner } = await import("./modules/survey/trap-scanner.js");
    const { RewardEstimator } = await import(
      "./modules/survey/reward-estimator.js"
    );
    const { RiskAssessor } = await import(
      "./modules/survey/risk-assessor.js"
    );
    const { QuestionClassifier } = await import(
      "./modules/survey/question-classifier.js"
    );

    const handle = await launchBrowser({
      headless: opts.headful !== "true",
    });
    await handle.page.goto(url, { waitUntil: "domcontentloaded" });

    const panel = await new PanelDetector().detect(handle.page);
    const traps = await new TrapScanner().scan(handle.page);
    const reward = await new RewardEstimator().estimate(handle.page);
    const questions = await new QuestionClassifier().classify(handle.page);
    const risk = new RiskAssessor().assess(
      panel.id,
      traps,
      0,
      questions.filter((q) => q.type === "text" || q.type === "textarea")
        .length
    );

    const result = { panel, traps, reward, risk, questions };

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n🔍 Survey Scan: ${url}`);
      console.log(`  Panel:    ${panel.id} (${(panel.confidence * 100).toFixed(0)}%)`);
      console.log(`  Reward:   ${reward.amountEur ?? "?"} € / ${reward.timeMinutes ?? "?"} min → ${reward.eurPerHour ?? "?"} €/h`);
      console.log(`  Risk:     ${risk.riskLevel} (${(risk.dqProbability * 100).toFixed(0)}% DQ probability)`);
      console.log(`  Traps:    ${traps.length} found`);
      for (const t of traps) {
        console.log(`    ⚠️  ${t.type}: ${t.description}`);
      }
      console.log(`  Questions: ${questions.map((q) => `${q.type}(${q.count})`).join(", ")}`);
      console.log();
    }

    await handle.close();
  });

survey
  .command("panel")
  .description("Detect which survey panel engine is running.")
  .argument("<url>", "Survey page URL")
  .action(async (url: string) => {
    const { launchBrowser } = await import("./browser/runner.js");
    const { PanelDetector } = await import(
      "./modules/survey/panel-detector.js"
    );
    const handle = await launchBrowser({ headless: true });
    await handle.page.goto(url, { waitUntil: "domcontentloaded" });
    const result = await new PanelDetector().detect(handle.page);
    console.log(JSON.stringify(result, null, 2));
    await handle.close();
  });

survey
  .command("traps")
  .description("Scan survey page for honeypots and attention checks.")
  .argument("<url>", "Survey page URL")
  .action(async (url: string) => {
    const { launchBrowser } = await import("./browser/runner.js");
    const { TrapScanner } = await import("./modules/survey/trap-scanner.js");
    const handle = await launchBrowser({ headless: true });
    await handle.page.goto(url, { waitUntil: "domcontentloaded" });
    const result = await new TrapScanner().scan(handle.page);
    console.log(JSON.stringify(result, null, 2));
    await handle.close();
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
  .option('--telemetry-out <path>', 'write per-item telemetry as JSONL to this path')
  .option('--webhook <url>', 'POST a JSON summary to this webhook on completion')
  .option('--slack <url>', 'post a Slack message on completion')
  .option('--discord <url>', 'post a Discord message on completion')
  .action(async (opts) => {
    const store = new StateStore({ dir: opts.stateDir });
    const qm = new QueueManager({
      store,
      fastMode: Boolean(opts.fastMode),
      noJitter: opts.jitter === false,
    });
    await qm.load();
    const telemetry = new Telemetry();

    const sim = String(opts.simulate);
    const final = await qm.run(async (survey, _ctx) => {
      const t0 = Date.now();
      let outcome: 'success' | 'disqualified' | 'failed';
      if (sim === 'success' || sim === 'disqualified' || sim === 'failed') outcome = sim;
      else outcome = pickMixed(survey.id);
      telemetry.recordResult(
        { survey },
        outcome === 'success' ? 'success' : outcome === 'failed' ? 'failed' : 'skipped',
        Date.now() - t0,
      );
      return { outcome };
    });
    const summary = telemetry.summary();
    if (opts.telemetryOut) {
      await fs.writeFile(path.resolve(String(opts.telemetryOut)), telemetry.toJSONL() + '\n', 'utf8');
    }
    const notifier = new Notifier({
      ...(opts.webhook ? { webhookUrl: String(opts.webhook) } : {}),
      ...(opts.slack ? { slackUrl: String(opts.slack) } : {}),
      ...(opts.discord ? { discordUrl: String(opts.discord) } : {}),
    });
    if (opts.webhook || opts.slack || opts.discord) {
      await notifier.send({
        level: summary.failures === 0 ? 'success' : 'warn',
        title: 'unmask queue run finished',
        message: `${summary.successes} ok, ${summary.failures} failed, ${summary.skipped} skipped`,
        fields: {
          successRate: summary.successRate.toFixed(2),
          totalRewardEUR: summary.totalRewardEUR.toFixed(2),
          effectiveEurPerHour: summary.effectiveEurPerHour.toFixed(2),
        },
      });
    }
    await emit({ ...final, telemetry: summary });
  });

// ---- serve (IPC for playstealth-cli / external callers) --------------------
program
  .command('serve')
  .description(
    'Run unmask-cli as a JSON-RPC 2.0 server (issues #14, #15). Default mode is stdio; use --http to bind a TCP port.',
  )
  .option('--stdio', 'newline-delimited JSON-RPC over stdin/stdout', false)
  .option('--http', 'expose HTTP+WebSocket server', false)
  .option('--port <port>', 'HTTP port (default 8765)', '8765')
  .option('--host <host>', 'HTTP host (default 127.0.0.1)', '127.0.0.1')
  .option('--auth-token <token>', 'require Bearer token on HTTP/WS')
  .action(async (opts) => {
    if (opts.http) {
      const httpOpts: Parameters<typeof runHttpServer>[0] = {
        port: Number(opts.port),
        host: String(opts.host),
      };
      if (opts.authToken !== undefined) httpOpts.authToken = String(opts.authToken);
      await runHttpServer(httpOpts);
      return;
    }
    // default = stdio
    await runStdioServer();
  });

// ---- bundle ----------------------------------------------------------------
program
  .command('bundle')
  .description('Zip a session directory into a single replay bundle (issue #12).')
  .argument('<session-dir>', 'path to ~/.unmask/sessions/<id>')
  .option('-o, --output <path>', 'output zip path')
  .action(async (sessionDir: string, opts) => {
    const result = await bundleSession(path.resolve(sessionDir), opts.output);
    await emit({ bundle: result });
  });

// ---- doctor ----------------------------------------------------------------
program
  .command('doctor')
  .description('Self-diagnostic: Node version, Playwright browsers, LLM key, write paths (issue #19).')
  .action(async () => {
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    const nodeOk = Number(process.versions.node.split('.')[0]) >= 20;
    checks.push({
      name: 'node>=20',
      ok: nodeOk,
      detail: process.version,
    });
    let playwrightOk = false;
    let playwrightDetail = 'not detected';
    try {
      const pkgPath = (await import('node:url')).fileURLToPath(
        await import.meta.resolve('playwright/package.json'),
      );
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      playwrightOk = true;
      playwrightDetail = `playwright@${pkg.version}`;
    } catch (err) {
      playwrightDetail = (err as Error).message;
    }
    checks.push({ name: 'playwright', ok: playwrightOk, detail: playwrightDetail });

    const homeDir = path.join(homedir(), '.unmask');
    let homeOk = true;
    let homeDetail = homeDir;
    try {
      await fs.mkdir(homeDir, { recursive: true });
    } catch (err) {
      homeOk = false;
      homeDetail = (err as Error).message;
    }
    checks.push({ name: 'home-dir', ok: homeOk, detail: homeDetail });

    checks.push({
      name: 'llm-key',
      ok: isLLMAvailable(),
      detail: isLLMAvailable() ? 'env var set' : 'no AI_GATEWAY_API_KEY (LLM features disabled)',
    });

    const failed = checks.filter((c) => !c.ok && c.name !== 'llm-key').length;
    await emit({ checks, ok: failed === 0 });
    if (failed > 0) process.exitCode = 1;
  });

// ---- init ------------------------------------------------------------------
program
  .command('init')
  .description('Scaffold a fresh state directory (issue #24).')
  .option('--state-dir <dir>', 'where to scaffold', '.unmask')
  .action(async (opts) => {
    const dir = path.resolve(String(opts.stateDir));
    await fs.mkdir(dir, { recursive: true });
    const store = new StateStore({ dir });
    await store.load();
    await emit({ ok: true, dir });
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
