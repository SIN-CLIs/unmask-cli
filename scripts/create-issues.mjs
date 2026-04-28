#!/usr/bin/env node
/**
 * Creates the v1 epic + sub-issue tree for unmask-cli.
 *
 * Strategy:
 *  - One issue per item (epics + children)
 *  - Epics labeled 'epic'; children labeled 'subtask' + topic
 *  - Children link back to their epic in the body
 *  - Epic body contains a markdown task list of children (GitHub renders
 *    these as native sub-issues when they are real issue references)
 *
 * Idempotent-ish: skips creating a label if it exists; new issues are
 * always appended (don't re-run unless you want fresh issues).
 */
import { request } from 'node:https';

const REPO = 'SIN-CLIs/unmask-cli';
const PAT = process.env.GH_PAT;
if (!PAT) {
  console.error('GH_PAT env var required');
  process.exit(1);
}

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = request(
      {
        method,
        host: 'api.github.com',
        path: `/repos/${REPO}${path}`,
        headers: {
          Authorization: `token ${PAT}`,
          'User-Agent': 'unmask-issue-creator',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(data) : 0,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${method} ${path}: ${text}`));
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve(text);
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function ensureLabel(name, color, description) {
  try {
    await gh('POST', '/labels', { name, color, description });
    console.log(`  + label ${name}`);
  } catch (e) {
    if (!String(e.message).includes('already_exists')) console.log(`  ~ label ${name} (${e.message.split('\n')[0]})`);
  }
}

const LABELS = [
  ['epic', '6E40C9', 'Multi-step initiative grouping sub-issues'],
  ['subtask', 'C5DEF5', 'Child of an epic'],
  ['llm', '0E8A16', 'AI / LLM functionality'],
  ['observability', 'FBCA04', 'Tracing, HAR, telemetry'],
  ['integration', 'D93F0B', 'Cross-CLI integration (playstealth)'],
  ['dx', '5319E7', 'Developer experience'],
  ['quality', '0366D6', 'Tests, CI, hardening'],
  ['priority:p0', 'B60205', 'Blocker for v1.0'],
  ['priority:p1', 'D93F0B', 'High priority for v1.0'],
  ['priority:p2', 'FBCA04', 'Nice-to-have for v1.0'],
];

const EPICS = [
  {
    title: 'Epic: LLM Reasoning Layer (act / extract / observe)',
    labels: ['epic', 'llm', 'priority:p0'],
    summary:
      'Bring unmask up to 2026 SOTA by exposing a Stagehand/Browser-Use-style reasoning layer. The X-ray data we already capture (CDP network, semantic DOM, console) becomes input for an LLM that emits structured, schema-validated actions. This is the single biggest differentiator vs vanilla Playwright wrappers.',
    children: [
      {
        title: 'feat(llm): observe(intent) API returning ranked candidate actions',
        labels: ['subtask', 'llm', 'priority:p0'],
        body: 'Given a natural-language intent (e.g. "the start survey button"), produce a ranked list of `ActionCandidate` records: selector, label, role, confidence, reasoning. Backed by the AI-SDK; no provider lock-in.',
      },
      {
        title: 'feat(llm): extract<T>(zodSchema) API for structured page data',
        labels: ['subtask', 'llm', 'priority:p0'],
        body: 'Feed the serialized semantic DOM + visible text into an LLM constrained by a Zod schema. Returns a fully validated typed object or throws with field-level errors.',
      },
      {
        title: 'feat(llm): act(intent) compound API (observe → resolve → execute)',
        labels: ['subtask', 'llm', 'priority:p1'],
        body: 'High-level `act("click the consent banner accept button")` that uses observe(), self-healing selectors, and (optional) Vision fallback. Stays read-only by default — execution is opt-in.',
      },
      {
        title: 'feat(llm): DOM-tree-to-LLM serializer (Browser-Use style)',
        labels: ['subtask', 'llm', 'priority:p0'],
        body: 'Compact tree representation of interactable elements with stable indices [0],[1],... Optimised for LLM context budgets (token-aware truncation, ARIA-first naming).',
      },
      {
        title: 'feat(llm): Vision fallback when DOM heuristic confidence < 0.5',
        labels: ['subtask', 'llm', 'priority:p1'],
        body: 'Take a screenshot, send it to a multimodal model, get back element bounding boxes, map back to selectors via `elementsFromPoint()`. Works with any AI-SDK vision provider.',
      },
    ],
  },
  {
    title: 'Epic: Forensic Replay & Artifacts',
    labels: ['epic', 'observability', 'priority:p0'],
    summary:
      'Every run must be reproducible from artifacts alone. A failed survey at 03:00 should be debuggable from a single zip without re-running the browser. This is what separates toys from tools.',
    children: [
      {
        title: 'feat(replay): per-session HAR export (full request/response bodies)',
        labels: ['subtask', 'observability', 'priority:p0'],
        body: 'Use Playwright `recordHar` plus our CDP-captured response bodies to produce a HAR 1.2 file richer than vanilla Playwright HARs.',
      },
      {
        title: 'feat(replay): Playwright trace.zip per session',
        labels: ['subtask', 'observability', 'priority:p0'],
        body: 'Wrap context.tracing.start/stop around each session. Output goes into the bundle directory.',
      },
      {
        title: 'feat(replay): screenshot timeline (every action + on failure)',
        labels: ['subtask', 'observability', 'priority:p1'],
        body: 'PNG per significant event with monotonic frame index, plus an HTML index for easy browsing.',
      },
      {
        title: 'feat(replay): single-zip bundle exporter (`unmask bundle <session>`)',
        labels: ['subtask', 'observability', 'priority:p0'],
        body: 'Bundles HAR, trace, screenshots, JSONL telemetry, manifest.json into one downloadable zip with checksums.',
      },
      {
        title: 'feat(replay): network mock/replay (offline tests from HAR)',
        labels: ['subtask', 'observability', 'priority:p2'],
        body: 'Spin up a local intercept server that serves responses from a HAR. Required for deterministic CI.',
      },
    ],
  },
  {
    title: 'Epic: Integration with playstealth-cli (Sense + Act stack)',
    labels: ['epic', 'integration', 'priority:p0'],
    summary:
      'unmask is the X-ray, playstealth is the ninja-mask. Together they form the Sense+Act stack. We need a stable IPC contract so playstealth (Python) can consume unmask (Node) without reimplementing CDP.',
    children: [
      {
        title: 'feat(ipc): JSON-RPC server over stdio (`unmask serve --stdio`)',
        labels: ['subtask', 'integration', 'priority:p0'],
        body: 'JSON-RPC 2.0 framed messages on stdin/stdout. Methods: `inspect`, `observe`, `extract`, `act`, `bundle`, `shutdown`. Zero deps, easy to spawn from Python via subprocess.',
      },
      {
        title: 'feat(ipc): HTTP+WebSocket server (`unmask serve --http :PORT`)',
        labels: ['subtask', 'integration', 'priority:p1'],
        body: 'Same RPC surface but over HTTP for long-running sessions and live event streaming via WS.',
      },
      {
        title: 'feat(ipc): publish shared schemas as `@unmask/schemas` for cross-language reuse',
        labels: ['subtask', 'integration', 'priority:p1'],
        body: 'Generate JSON Schema from Zod and ship a tiny package consumable from any language (Python via `pydantic`).',
      },
      {
        title: 'docs(integration): Python recipe in HACKING.md showing playstealth ↔ unmask',
        labels: ['subtask', 'integration', 'dx', 'priority:p1'],
        body: 'End-to-end snippet: playstealth runs the human flow; unmask provides observe/extract; bundle gets attached on failure.',
      },
    ],
  },
  {
    title: 'Epic: Production Readiness & Self-Diagnostics',
    labels: ['epic', 'quality', 'priority:p0'],
    summary:
      'A clean install must "just work". Add postinstall, doctor command, real E2E tests against local fixtures, wire up the self-healing selectors that already exist, and ship EUR/h telemetry that Issue #2 explicitly asked for.',
    children: [
      {
        title: 'fix(install): postinstall hook running `playwright install chromium`',
        labels: ['subtask', 'quality', 'priority:p0'],
        body: 'Skip when `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Document opt-out for CI matrices.',
      },
      {
        title: 'feat(cli): `unmask doctor` self-diagnostic',
        labels: ['subtask', 'quality', 'priority:p0'],
        body: 'Checks: Node version, Playwright binary present, browsers installed, write access to state dir, sample CDP attach. Outputs colour-coded report.',
      },
      {
        title: 'fix(queue): wire self-healing selector resolver into QueueManager',
        labels: ['subtask', 'quality', 'priority:p0'],
        body: 'The class exists but is never called. Use it for every `actionType !== "noop"` step before declaring failure.',
      },
      {
        title: 'feat(telemetry): EUR/h tracking and JSONL export (closes part of #2)',
        labels: ['subtask', 'observability', 'priority:p1'],
        body: 'Per-survey reward + duration → cumulative EUR/h for the active session. Stream to JSONL for the TUI.',
      },
      {
        title: 'test(e2e): real-browser test against local HTML fixture',
        labels: ['subtask', 'quality', 'priority:p0'],
        body: 'Serve a tiny static page from a vitest fixture, run inspect+observe+extract end-to-end with the actual Chromium.',
      },
      {
        title: 'feat(notify): webhook + console alerts on session failure / completion',
        labels: ['subtask', 'observability', 'priority:p2'],
        body: 'Generic webhook with HMAC signature. Discord/Slack templates as adapters.',
      },
    ],
  },
  {
    title: 'Epic: Developer Experience',
    labels: ['epic', 'dx', 'priority:p1'],
    summary: 'Lower the on-ramp. A first-time user should ship a working flow in <10 minutes.',
    children: [
      {
        title: 'feat(cli): `unmask init` interactive setup wizard',
        labels: ['subtask', 'dx', 'priority:p1'],
        body: 'Picks state dir, validates browser install, scaffolds a starter `surveys.json` and example session script.',
      },
      {
        title: 'docs: typedoc API reference + mkdocs site published to GH Pages',
        labels: ['subtask', 'dx', 'priority:p2'],
        body: 'CI job builds and deploys docs on tag.',
      },
      {
        title: 'feat: examples/ directory (consent-bypass, infinite-scroll, multi-tab survey)',
        labels: ['subtask', 'dx', 'priority:p2'],
        body: 'Runnable examples that double as integration tests.',
      },
    ],
  },
];

(async () => {
  console.log('### Ensuring labels');
  for (const [name, color, desc] of LABELS) {
    await ensureLabel(name, color, desc);
  }

  const created = [];
  // Pass 1: create child issues so we know their numbers
  console.log('\n### Creating child issues');
  for (const epic of EPICS) {
    epic.childNumbers = [];
    for (const child of epic.children) {
      const issue = await gh('POST', '/issues', {
        title: child.title,
        labels: child.labels,
        body: `${child.body}\n\n---\nPart of Epic: _to be linked_`,
      });
      epic.childNumbers.push(issue.number);
      created.push(`#${issue.number} ${child.title}`);
      console.log(`  + #${issue.number} ${child.title}`);
    }
  }

  // Pass 2: create epics with task list referencing children (renders as sub-issues)
  console.log('\n### Creating epics with sub-issue task lists');
  for (const epic of EPICS) {
    const taskList = epic.children
      .map((c, i) => `- [ ] #${epic.childNumbers[i]} — ${c.title.replace(/^[^:]+:\s*/, '')}`)
      .join('\n');
    const body = `${epic.summary}\n\n## Sub-issues\n\n${taskList}\n`;
    const issue = await gh('POST', '/issues', { title: epic.title, labels: epic.labels, body });
    created.push(`#${issue.number} ${epic.title} (EPIC)`);
    console.log(`  + #${issue.number} ${epic.title}`);

    // Pass 3: backlink each child to its epic
    for (const num of epic.childNumbers) {
      await gh('PATCH', `/issues/${num}`, {
        body: `${epic.children[epic.childNumbers.indexOf(num)].body}\n\n---\nPart of Epic: #${issue.number}`,
      });
    }

    // Best-effort native sub-issue links via REST (preview header). Falls back silently.
    for (const num of epic.childNumbers) {
      try {
        await gh('POST', `/issues/${issue.number}/sub_issues`, { sub_issue_id: num });
      } catch {
        // older API surfaces require numeric DB id; task-list rendering still works
      }
    }
  }

  console.log('\n### Done. Created:');
  for (const line of created) console.log(' -', line);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
