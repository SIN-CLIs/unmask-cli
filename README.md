# unmask-cli

> X-ray vision for web automation agents.
>
> While [`playstealth-cli`](https://github.com/SIN-CLIs/playstealth-cli) is the
> "ninja costume" that hides your agent, `unmask-cli` is the X-ray that lets
> the agent **see everything** — raw JSON on the wire, semantic DOM structure,
> live console output, and self-healing selectors that survive redesigns.

[![CI](https://github.com/SIN-CLIs/unmask-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/SIN-CLIs/unmask-cli/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-43853d)
![TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Why

Modern anti-bot systems break "click here, then there" automation in a single
release. SOTA in 2026 is **Network-First Extraction + Semantic DOM + Self-Healing
Selectors + Schema-Validated JSON Output**. `unmask-cli` ships all four in one
TypeScript package, and a sequential queue worker that emulates a single human.

## Modules

| Module           | Role               | What it does                                                                 |
| ---------------- | ------------------ | ---------------------------------------------------------------------------- |
| `unmask-network` | The Sniffer        | Hooks Chrome DevTools Protocol; captures every JSON response and tags it.    |
| `unmask-dom`     | Semantic Scanner   | Scores elements by meaning (ARIA, role, price tokens, ratings) — not by ID.  |
| `unmask-console` | The Mind Reader    | Streams browser console with heuristic tags (loop, error, load, network…).   |
| `selfHeal`       | Selector Recovery  | Primary selector → fallbacks → role/text → screenshot for vision recovery.   |
| `QueueManager`   | Sequential Worker  | Strictly serial, persistent state.json, blacklist, fast-switch on screenout. |

All output is validated against **Zod schemas** before it leaves the tool.
Downstream agents can rely on the contract — there is no "garbage JSON".

## Install

```bash
npm install unmask-cli
# or
pnpm add unmask-cli
```

After install you also need a Chromium binary for Playwright:

```bash
npx playwright install chromium
```

## CLI

```text
unmask inspect <url>     # Run network + dom + console, emit one JSON document
unmask network <url>     # Only the CDP sniffer
unmask dom     <url>     # Only the semantic DOM scanner
unmask console <url>     # Only the live console listener
unmask queue   <subcmd>  # Sequential queue worker (Issue #2)
```

Global flags: `--json-logs`, `--silent`, `--log-level debug|info|warn|error`.

### Inspect

```bash
unmask inspect https://example.com/dashboard \
  --wait-selector "[data-survey]" \
  --only-matched-network \
  --screenshot ./out.png \
  -o ./dashboard.json
```

The output is a single `UnmaskResponse` JSON document:

```json
{
  "schemaVersion": 1,
  "tool": "unmask-cli",
  "timestamp": "2026-04-27T02:45:00Z",
  "url": "https://example.com/dashboard",
  "status": "success",
  "durationMs": 4123,
  "surveys": [
    {
      "id": "63738621",
      "reward": { "amount": 0.5, "currency": "EUR" },
      "durationMinutes": 12,
      "confidence": 0.92,
      "selector": "[data-id=\"63738621\"]",
      "fallbackSelectors": ["#63738621", "[data-survey-id=\"63738621\"]"],
      "actionType": "click",
      "metadata": { "source": "network", "sourceUrl": "https://example.com/api/list" }
    }
  ],
  "network": [ /* tagged JSON captures */ ],
  "dom": [ /* scored DOM candidates */ ],
  "console": [ /* tagged console entries */ ],
  "errors": []
}
```

### Queue (sequential worker)

The queue follows the **Human-Emulation Strategy**: one item at a time, a
500-1000 ms micro-jitter between steps, a 30-60 s human pause after each
success, and an aggressive fast-switch on disqualification (no pause, just
clean cookies and move on).

```bash
# 1) Seed the queue
unmask queue add ./surveys.json --state-dir ./.unmask

# 2) Blacklist IDs you never want to retry
unmask queue blacklist survey-002 survey-007 --state-dir ./.unmask

# 3) Inspect what's queued
unmask queue list --state-dir ./.unmask

# 4) Run sequentially (built-in simulation runner for smoke testing)
unmask queue run --state-dir ./.unmask --simulate mixed
```

State is persisted in `.unmask/state.json` and `.unmask/blacklist.json` with
atomic writes (temp-file + rename) so a crash mid-run never corrupts the file.

## Library API

```ts
import {
  launchBrowser,
  NetworkSniffer,
  DomScanner,
  ConsoleListener,
  selfHeal,
  QueueManager,
  StateStore,
  inspect,
  type UnmaskResponse,
} from 'unmask-cli';

// One-shot inspection
const res: UnmaskResponse = await inspect({
  url: 'https://example.com/dashboard',
  stealth: true,
  onlyMatchedNetwork: true,
});

// Self-healing click
const handle = await launchBrowser({ stealth: true });
await handle.page.goto('https://example.com');
const { locator, source } = await selfHeal(handle.page, {
  primary: '#start',
  fallbacks: ['[role="button"][aria-label="Start"]'],
  role: 'button',
  text: 'Start',
  screenshotOnMiss: true,
});
console.log('matched via', source);
await locator.click();

// Custom queue runner
const qm = new QueueManager({
  store: new StateStore({ dir: './.unmask' }),
  context: handle.context,
  cleanupOriginsForDq: (s) => [new URL(String(s.metadata?.sourceUrl ?? 'https://x')).hostname],
});
await qm.load();
await qm.run(async (survey) => {
  // your real automation here
  return { outcome: 'success' };
});
```

## SOTA Best Practices baked in

1. **Network-first extraction (API over DOM).** CDP `Network.getResponseBody`
   on every JSON-ish response, tagged with keyword heuristics so the agent can
   ignore noise.
2. **Semantic, ARIA-first selectors.** The DOM scanner ranks elements by
   meaning (role, aria-label, price tokens, rating hints) and emits both a
   primary and fallback selector list.
3. **Self-Healing.** `selfHeal()` walks `primary → fallbacks → role+name →
   text → screenshot`. The recovered selector is fed back through
   `SurveyResult.recoveredSelector` and persisted by the queue so subsequent
   runs use the new selector directly.
4. **Schema-first JSON.** Every payload is validated by Zod (`UnmaskResponse`,
   `Survey`, `QueueState`). Bad data fails loudly instead of silently.
5. **Sequential queue with human emulation.** Never parallel. Micro-jitter
   between steps. Fast-switch on screenout with cookie cleanup. Persistent,
   resumable state. Permanent blacklist.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # emit ./dist
npm test            # vitest
npm run lint        # eslint src
```

CI runs typecheck, build and tests on Node 20 and 22.

## Issues addressed

- `#1 — Das Röntgengerät`: implements `unmask-network`, `unmask-dom`,
  `unmask-console`, self-healing selectors and schema-first JSON output.
- `#2 — Für die Worker Agenten`: implements the strict sequential queue with
  persistent `state.json`, blacklist append support, fast-switch on
  disqualification, micro-jitter and the human pause between successes.

## License

MIT © SIN-CLIs
