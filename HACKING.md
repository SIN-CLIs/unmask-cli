# HACKING — unmask-cli

Internal architecture and integration notes. End-user docs are in `README.md`.

## Two-cli architecture (Sense + Act)

`unmask-cli` and [`playstealth-cli`](https://github.com/SIN-CLIs/playstealth-cli)
are deliberately split:

| Layer | Tool | Responsibility |
|---|---|---|
| Sense (X-ray gear) | **unmask-cli** | Network sniffing, DOM analysis, console listening, LLM observe/extract/act, replay bundles. |
| Act (ninja mask) | **playstealth-cli** | Stealth profile, persona, proxy binding, human-input timing, anti-detect patches. |

They communicate over **JSON-RPC 2.0**:

```
+--------------------+        stdio JSON-RPC 2.0        +--------------------+
|  playstealth-cli   |  <----------------------------> |     unmask-cli     |
|  (Python, ninja)   |       observe/act/extract       |  (Node, X-ray)     |
+--------------------+                                   +--------------------+
        |                                                          |
        v                                                          v
   Patchright / Camoufox / playwright-stealth     Playwright + CDP + AI SDK
   Persona/Proxy/CAPTCHA/Mouse-Bezier             Network sniffer + DOM scanner
```

## Running unmask-cli as a daemon

```bash
# stdio (default for embedded use)
unmask serve --stdio

# HTTP+WebSocket (cross-host, multi-language)
unmask serve --http --port 8765 --auth-token <token>
```

Methods (see `src/ipc/dispatch.ts`):

| Method | Params | Returns |
|---|---|---|
| `ping` | — | `{ pong, ts }` |
| `open` | `{ url, headless?, cdpEndpoint?, sessionLabel? }` | `{ handleId, sessionId, sessionDir }` |
| `navigate` | `{ handleId, url }` | `{ url }` |
| `observe` | `{ handleId, intent, topK?, vision? }` | `ObserveCandidate[]` |
| `act` | `{ handleId, intent, verb?, value?, vision?, dryRun? }` | `ActResult` |
| `extract` | `{ handleId, instruction?, vision? }` | `unknown` (LLM output) |
| `scanDom` | `{ handleId, max?, minConfidence? }` | `DomCandidate[]` |
| `screenshot` | `{ handleId, fullPage? }` | `{ path }` |
| `bundle` | `{ handleId }` | `{ bundle }` |
| `session` | `{ handleId }` | `{ sessionId, sessionDir }` |
| `list` | — | handle list |
| `close` | `{ handleId }` | `{ ok, sessionId, sessionDir }` |
| `shutdown` | — | `{ ok }` |

## Python integration recipe

A ready-made Python client lives at
`integrations/python/unmask_client.py`.

```python
from unmask_client import UnmaskClient

with UnmaskClient(cmd=["unmask", "serve", "--stdio"]) as unmask:
    h = unmask.open(url="https://surveys.example.com/start", session_label="run-42")

    # 1. semantic discovery
    candidates = unmask.observe(h, intent="the survey list with highest reward", top_k=5)

    # 2. structured action through self-healing selector
    res = unmask.act(h, intent="click the highest-paying survey")

    # 3. structured extraction
    surveys = unmask.extract(
        h,
        instruction="extract every survey on the page as {id,reward_eur,duration_min}",
    )

    # 4. forensic bundle
    bundle_path = unmask.bundle(h)
    unmask.close_handle(h)
```

### Combining with playstealth-cli

`playstealth-cli` owns the browser launch (so it can apply stealth patches,
persona profile, proxy, etc.). To make `unmask-cli` *attach* instead of
launching its own browser, expose a CDP endpoint from playstealth and pass it:

```python
# 1. playstealth launches a stealth Chromium with --remote-debugging-port=9222
playstealth_proc = launch_stealth_browser(persona="alice", proxy="http://...")

# 2. unmask attaches over CDP — no second browser, no fingerprint mismatch
with UnmaskClient() as unmask:
    h = unmask.open(url="https://surveys.example.com", cdp_endpoint="http://127.0.0.1:9222")
    ...
```

## Session artifacts

Every `open()` creates a session directory under `~/.unmask/sessions/<id>/`:

```
~/.unmask/sessions/2026-04-28T12-00-00-abcd1234/
├── meta.json            # session metadata + duration
├── events.jsonl         # observe/act/extract/network/console events
├── network.har          # full HTTP traffic (issue #9)
├── trace.zip            # Playwright trace (issue #10)
└── screenshots/
    ├── 0000.png         # one per `screenshot` call + on-failure
    └── 0001.png
```

Use `unmask bundle <session-dir>` to zip it for sharing or replay.

## LLM provider configuration

The LLM layer uses the [Vercel AI SDK](https://sdk.vercel.ai). By default it
talks to the Vercel AI Gateway with model `google/gemini-3-flash`:

```bash
export AI_GATEWAY_API_KEY=...           # zero-config gateway
# or
export GOOGLE_GENERATIVE_AI_API_KEY=... # direct Google
```

Override the model:

```ts
await observe(page, "primary CTA", { model: "anthropic/claude-opus-4.6" });
```

If no key is set, `observe()` automatically falls back to the pure-DOM
heuristic (no LLM call). `extract()` and `act(text)` require a key.

## Replay / mock testing

Captured HARs and events bundles can be replayed via Playwright's
`page.routeFromHAR()` (issue #13). Pattern:

```ts
import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.routeFromHAR("/path/to/network.har", { update: false });
await page.goto("https://surveys.example.com/start");
```

This lets you build deterministic E2E tests against a frozen capture.
