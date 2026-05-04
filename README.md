# unmask-cli

[![Graphify](https://img.shields.io/badge/Graphify-Knowledge%20Graph-2ea44f?logo=gitbook&logoColor=white)](graphify-out/graph.html)

> **The X-ray vision layer for web automation.** A TypeScript Playwright toolkit
> that captures everything a page does — every fetch, every console log, every
> interactable element — exposes it through a typed JSON-RPC API, and runs your
> queue strictly sequentially without dropping a single byte of evidence.
>
> Pair it with [`playstealth-cli`](https://github.com/SIN-CLIs/playstealth-cli)
> to get the **ninja mask** (anti-detect, persona binding, human input rhythms).
> `unmask` sees, `playstealth` hides, your agent thinks.

[![CI](https://github.com/SIN-CLIs/unmask-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/SIN-CLIs/unmask-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933)](package.json)

---

## Why this project exists

Every commercial web-automation product (Stagehand, Browser Use, Skyvern,
Browserbase) re-invents the same plumbing in its own private repo: CDP wiring,
semantic DOM scanning, an LLM `act/extract/observe` API, replay bundles for
failure forensics. `unmask-cli` makes that plumbing a **well-documented,
MIT-licensed, TypeScript-first standalone package** with a stable JSON-RPC
surface so it can be driven from Python, Go, or any other language.

## What you get

### Observation layer (the "X-ray")

| Module           | Source signal                                         | Output                                                                                                                              |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `unmask-network` | Chrome DevTools Protocol (`Network.*`, `Fetch.*`)     | Every fetch / XHR with full headers, request body, response body. Survives navigation via `Fetch.*` body capture.                   |
| `unmask-dom`     | Live DOM walk + Playwright `accessibility.snapshot()` | Every interactable element with a stable, prioritised selector (`data-testid` > `id` > `aria-label` > `role+name` > `text` > path). |
| `unmask-console` | `Page.console`, `pageerror`                           | Every log / warn / error with stack and severity.                                                                                   |
| `selfHeal`       | Multi-strategy resolver                               | Locator that survives small DOM changes by falling back through `data-testid` → `aria` → `role+name` → `text`.                      |

### Intelligence layer (LLM, optional)

`act / extract / observe` mirror the Stagehand API but consume our own
serialized accessibility tree, so the LLM gets the **same** ground truth our
agents do. The package degrades gracefully: without an `AI_GATEWAY_API_KEY`
all three fall back to deterministic DOM heuristics.

```ts
await act(page, 'click the start button');
const data = await extract(page, z.object({ price: z.number() }));
const candidates = await observe(page, 'all primary CTAs');
```

### Operational layer (the "queue")

- **Strictly sequential.** Exactly one survey at a time. No `Promise.all`.
- **Persistent state.** Atomic-write `~/.unmask/state.json`, survives crashes.
- **Blacklist** with stored reason and timestamp.
- **Telemetry**: success-rate, EUR/h, average duration; written as JSONL.
- **Webhooks**: Slack / Discord / generic JSON.
- **Replay bundles**: HAR + `trace.zip` + screenshots + JSONL events, packaged
  per session.

### Integration layer (the "API")

Run as a JSON-RPC 2.0 server on stdio (default) or HTTP+WebSocket so any
language can drive it:

```bash
unmask serve              # stdio, default
unmask serve --http       # HTTP at 127.0.0.1:8765
```

A reference Python client lives at
[`integrations/python/unmask_client.py`](integrations/python/unmask_client.py).

## Install

```bash
npm install -g unmask-cli            # or: pnpm add -g unmask-cli
unmask doctor                        # check Node / Playwright / LLM / home-dir
```

The postinstall hook automatically downloads the Chromium binary
(skip with `UNMASK_SKIP_BROWSER_INSTALL=1`).

## Quickstart — single page X-ray

```bash
unmask inspect https://example.com --out report.json
```

`report.json` contains the full `UnmaskResponse`:

```jsonc
{
  "url": "https://example.com",
  "title": "Example Domain",
  "elements": [
    {
      "selector": "a[href=\"https://www.iana.org/...\"]",
      "label": "More information…",
      "confidence": 0.84,
    },
  ],
  "network": [
    { "url": "...", "method": "GET", "status": 200, "requestHeaders": {}, "responseBody": "..." },
  ],
  "console": [{ "type": "warning", "text": "..." }],
}
```

## Quickstart — sequential survey queue

```bash
unmask init --state-dir .unmask
unmask queue add ./surveys.json --state-dir .unmask
unmask queue blacklist survey-bad --state-dir .unmask --reason "always disqualifies"
unmask queue run --state-dir .unmask \
  --telemetry-out ./telemetry.jsonl \
  --webhook https://hooks.slack.com/services/...
```

## CLI reference

| Command                           | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `unmask inspect <url>`            | Full one-shot X-ray (DOM + network + console).                 |
| `unmask network <url>`            | Network-only sniff.                                            |
| `unmask dom <url>`                | DOM-only semantic scan.                                        |
| `unmask console <url>`            | Console + pageerror only.                                      |
| `unmask init [--state-dir]`       | Scaffold an empty queue state directory.                       |
| `unmask queue add <surveys.json>` | Enqueue surveys.                                               |
| `unmask queue list`               | Show queue, blacklist, last results.                           |
| `unmask queue blacklist <id>`     | Persistently skip an item.                                     |
| `unmask queue unblacklist <id>`   | Re-enable a blacklisted item.                                  |
| `unmask queue run`                | Process queue strictly sequentially with telemetry + webhooks. |
| `unmask queue reset`              | Reset state (`--keep-blacklist` to preserve the blacklist).    |
| `unmask serve [--http]`           | JSON-RPC server (stdio default, HTTP+WS optional).             |
| `unmask bundle <session-dir>`     | Zip a session into a portable replay bundle.                   |
| `unmask doctor`                   | Self-diagnostic.                                               |

## Programmatic API (TypeScript)

```ts
import { launchBrowser, NetworkSniffer, DomScanner, ConsoleListener, selfHeal } from 'unmask-cli';

const h = await launchBrowser({ headless: true, stealth: true });
const sniff = await NetworkSniffer.attach(h.page);
const dom = new DomScanner(h.page);
const con = new ConsoleListener(h.page);

await h.page.goto('https://example.com');
const elements = await dom.scan();
await selfHeal(h.page, { primary: '#missing-button', role: 'button', text: 'start' }).then(
  ({ locator }) => locator.click(),
);

await h.close();
console.log(sniff.events.length, 'requests captured');
```

## JSON-RPC API (any language)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"browser.open","params":{"url":"https://example.com"}}' \
  | unmask serve
```

Methods: `browser.open`, `browser.close`, `dom.scan`, `network.list`,
`console.list`, `selfheal.click`, `act`, `extract`, `observe`, `queue.add`,
`queue.run`, `queue.list`, `bundle.create`. See [`HACKING.md`](HACKING.md)
for the full schema.

## Architecture: how it pairs with `playstealth-cli`

```
┌─────────────────────┐         JSON-RPC 2.0         ┌────────────────────────┐
│   Your agent        │  ──────────────────────────▶ │  unmask-cli (Node)     │
│   (Python / TS /    │                              │  ┌──────────────────┐  │
│    anything)        │  ◀── events / responses ──── │  │ DOM / NET / CON  │  │
└─────────────────────┘                              │  │ act/extract/obs  │  │
                                                     │  │ Queue / Replay   │  │
                                                     │  └──────────────────┘  │
                                                     └─────┬──────────────────┘
                                                           │ CDP attach
                                                           ▼
                                                     ┌────────────────────────┐
                                                     │  playstealth-cli       │
                                                     │  (Python, Chrome)      │
                                                     │  - persona profile     │
                                                     │  - fingerprint patches │
                                                     │  - human input         │
                                                     └────────────────────────┘
```

`playstealth-cli` launches the stealth browser and exposes a CDP endpoint;
`unmask-cli serve` connects with `--cdp-endpoint` and runs the observation +
queue logic inside that hardened context.

## Roadmap

Tracked as GitHub issues. Epics:
[#27 X-Ray Pro](https://github.com/SIN-CLIs/unmask-cli/issues/27),
[#28 Intelligence](https://github.com/SIN-CLIs/unmask-cli/issues/28),
[#29 Operations](https://github.com/SIN-CLIs/unmask-cli/issues/29),
[#30 Integration](https://github.com/SIN-CLIs/unmask-cli/issues/30),
[#31 Developer Experience](https://github.com/SIN-CLIs/unmask-cli/issues/31).

## License

MIT — see [LICENSE](LICENSE).

---

## 🔗 Stealth Suite

Part of the **SIN-CLIs Stealth Suite** — 17 Komponenten für autonome Browser-Automation:

| Layer | Repo | Technologie |
|-------|------|-------------|
| 🧠 Orchestrator | [stealth-runner](https://github.com/SIN-CLIs/stealth-runner) | Python |
| 🧠 ROUTER | [stealth-axiom](https://github.com/SIN-CLIs/stealth-axiom) | Python |
| 🖱️ ACT (CUA-ONLY) | [cua-touch](https://github.com/SIN-CLIs/cua-touch) | Python + Swift |
| 🎭 HIDE | [playstealth-cli](https://github.com/SIN-CLIs/playstealth-cli) | Python |
| 👁️ SENSE | [unmask-cli](https://github.com/SIN-CLIs/unmask-cli) | TypeScript |
| 📹 VERIFY | [screen-follow](https://github.com/SIN-CLIs/screen-follow) | Swift |
| 🔍 SCAN | [macos-ax-cli](https://github.com/SIN-CLIs/macos-ax-cli) | Swift |
| 🐙 AX-INDEXER | [ax-graph](https://github.com/SIN-CLIs/ax-graph) | Swift |
| 🔒 CAPTCHA | [stealth-captcha](https://github.com/SIN-CLIs/stealth-captcha) | Python |
| 🧩 SKILLS | [stealth-skills](https://github.com/SIN-CLIs/stealth-skills) | TS/Python |
| 🧱 CORE | [stealth-core](https://github.com/SIN-CLIs/stealth-core) | Python |
| 🧠 MIND | [stealth-mind](https://github.com/SIN-CLIs/stealth-mind) | Python |
| 🛡️ GUARDIAN | [stealth-guardian](https://github.com/SIN-CLIs/stealth-guardian) | Python |
| 🔄 SYNC | [stealth-sync](https://github.com/SIN-CLIs/stealth-sync) | Python |
| ⚡ SESSION | [stealth-session](https://github.com/SIN-CLIs/stealth-session) | Python |
| 🎯 DYNAMIC | [stealth-dynamic](https://github.com/SIN-CLIs/stealth-dynamic) | Python |
| 💀 LEGACY | [skylight-cli](https://github.com/SIN-CLIs/skylight-cli) | Swift |
| 🔬 SOTA | [stealth-sota](https://github.com/SIN-CLIs/stealth-sota) | Python |
| 💀 LEGACY | [computer-use-mcp](https://github.com/SIN-CLIs/computer-use-mcp) | TypeScript |


## 🔗 Stealth Suite

Part of the **SIN-CLIs Stealth Suite** — 16 Komponenten für autonome Browser-Automation:

| Layer | Repo | Technologie |
|-------|------|-------------|
| 🧠 Orchestrator | [stealth-runner](https://github.com/SIN-CLIs/stealth-runner) | Python |
| 🖱️ ACT (CUA-ONLY) | [cua-touch](https://github.com/SIN-CLIs/cua-touch) | Python + Swift |
| 🎭 HIDE | [playstealth-cli](https://github.com/SIN-CLIs/playstealth-cli) | Python |
| 👁️ SENSE | [unmask-cli](https://github.com/SIN-CLIs/unmask-cli) | TypeScript |
| 📹 VERIFY | [screen-follow](https://github.com/SIN-CLIs/screen-follow) | Swift |
| 🔍 SCAN | [macos-ax-cli](https://github.com/SIN-CLIs/macos-ax-cli) | Swift |
| 🐙 AX-INDEXER | [ax-graph](https://github.com/SIN-CLIs/ax-graph) | Swift |
| 🔒 CAPTCHA | [stealth-captcha](https://github.com/SIN-CLIs/stealth-captcha) | Python |
| 🧩 SKILLS | [stealth-skills](https://github.com/SIN-CLIs/stealth-skills) | TS/Python |
| 🧱 CORE | [stealth-core](https://github.com/SIN-CLIs/stealth-core) | Python |
| 🧠 MIND | [stealth-mind](https://github.com/SIN-CLIs/stealth-mind) | Python |
| 🛡️ GUARDIAN | [stealth-guardian](https://github.com/SIN-CLIs/stealth-guardian) | Python |
| 🔄 SYNC | [stealth-sync](https://github.com/SIN-CLIs/stealth-sync) | Python |
| ⚡ SESSION | [stealth-session](https://github.com/SIN-CLIs/stealth-session) | Python |
| 💀 LEGACY | [skylight-cli](https://github.com/SIN-CLIs/skylight-cli) | Swift |
| 💀 LEGACY | [computer-use-mcp](https://github.com/SIN-CLIs/computer-use-mcp) | TypeScript |

---
