# commands.md — unmask-cli CLI-Befehle

## Installation

```bash
npm install -g unmask-cli
unmask doctor                        # Check: Node, Playwright, LLM, home-dir

# Postinstall: Chromium download (oder skip)
UNMASK_SKIP_BROWSER_INSTALL=1 npm install -g unmask-cli
playwright install chromium          # manuell
```

## Modus 1: CLI (one-shot inspection)

```bash
# Full X-ray: DOM + Network + Console
unmask inspect https://example.com --out report.json

# Network only
unmask network https://example.com --out net.json

# DOM only (semantic scan)
unmask dom https://example.com --out dom.json

# Console + pageerror only
unmask console https://example.com --out con.json
```

## Modus 2: JSON-RPC Server

```bash
# stdio (default — für Python/Go/any language)
unmask serve

# HTTP + WebSocket
unmask serve --http --port 8765

# Mit CDP-Attach (an playstealth's Chrome)
unmask serve --http --cdp-endpoint ws://127.0.0.1:9222
```

## JSON-RPC Methods

```bash
# Browser öffnen
echo '{"jsonrpc":"2.0","id":1,"method":"browser.open","params":{"url":"https://example.com"}}' \
  | unmask serve

# DOM scannen
echo '{"jsonrpc":"2.0","id":2,"method":"dom.scan","params":{}}' \
  | unmask serve

# Network sniff
echo '{"jsonrpc":"2.0","id":3,"method":"network.list","params":{}}' \
  | unmask serve

# Console logs
echo '{"jsonrpc":"2.0","id":4,"method":"console.list","params":{}}' \
  | unmask serve

# Self-healing click
echo '{"jsonrpc":"2.0","id":5,"method":"selfheal.click","params":{"role":"button","text":"start"}}' \
  | unmask serve

# LLM act
echo '{"jsonrpc":"2.0","id":6,"method":"act","params":{"prompt":"click the start button"}}' \
  | unmask serve

# LLM extract
echo '{"jsonrpc":"2.0","id":7,"method":"extract","params":{"schema":{"type":"object","properties":{"price":{"type":"number"}}}}}' \
  | unmask serve

# LLM observe
echo '{"jsonrpc":"2.0","id":8,"method":"observe","params":{"prompt":"all primary CTAs"}}' \
  | unmask serve
```

## Modus 3: Queue (sequential survey processing)

```bash
# Queue initialisieren
unmask init --state-dir .unmask

# Surveys hinzufügen (surveys.json Format)
unmask queue add ./surveys.json --state-dir .unmask

# Queue anzeigen
unmask queue list --state-dir .unmask

# Queue starten (strictly sequential!)
unmask queue run --state-dir .unmask \
  --telemetry-out ./telemetry.jsonl \
  --webhook https://hooks.slack.com/services/...

# Blacklist (Survey dauerhaft skippen)
unmask queue blacklist survey-123 --state-dir .unmask --reason "always disqualifies"

# Blacklist aufheben
unmask queue unblacklist survey-123 --state-dir .unmask

# Queue reset (Blacklist behalten)
unmask queue reset --state-dir .unmask --keep-blacklist
```

## Python Integration

```python
# integrations/python/unmask_client.py
import sys
sys.path.insert(0, '~/dev/unmask-cli/integrations/python')
from unmask_client import UnmaskClient

client = UnmaskClient('http://127.0.0.1:8765')  # oder stdio
result = client.inspect('https://heypiggy.com/survey/123')
print(result['elements'])  # Alle interagierbaren Elemente
print(result['network'])   # Alle API-Calls
```

## Self-Healing Selector

```bash
# Stabiler Klick — fällt durch Strategien durch
# data-testid → aria → role+name → text → path
echo '{"jsonrpc":"2.0","id":9,"method":"selfheal.click","params":{"primary":"#missing-button","fallback":{"role":"button","text":"start"}}}' \
  | unmask serve
```

## Replay Bundle

```bash
# Session als portablen Bundle zippen
unmask bundle /path/to/session-dir --out session.zip

# Bundle enthält:
# - HAR (network trace)
# - trace.zip (Playwright trace)
# - Screenshots
# - JSONL events
```

## Self-Diagnose

```bash
unmask doctor
# → Node version, Playwright, LLM API key, home-dir writable?
```

## Integration mit Stealth Suite

```bash
# 1. playstealth startet Chrome (CDP-Endpoint verfügbar)
playstealth launch --url 'https://heypiggy.com/?page=dashboard'
# → CDP endpoint: ws://127.0.0.1:9222

# 2. unmask-cli attacht (SENSE Layer)
unmask serve --http --cdp-endpoint ws://127.0.0.1:9222 &
# → DOM + Network + Console sniffing im gehärteten Kontext

# 3. skylight-cli klickt (ACT Layer)
PID=$(pgrep -f "Google Chrome" | head -1)
skylight-cli click --pid $PID --element-index 42

# 4. screen-follow zeichnet auf (VERIFY Layer)
screen-follow record --video --output /tmp/session.mp4

# 5. stealth-runner orchestriert (Orchestrator Layer)
PYTHONPATH=~/dev/stealth-runner python3 runner/step.py "https://..."
```