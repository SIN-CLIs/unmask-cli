# brain.md - Systemwissen (2026-05-01)

## unmask-cli Kern

- **Tech:** TypeScript, Playwright, CDP
- **API:** JSON-RPC 2.0 (stdio oder HTTP)
- **Methods:** dom.scan, network.list, console.list, act, extract, observe
- **Queue:** Strict sequential, persistent state, blacklist, telemetry

## Integration

- Start: `unmask serve --http` (Port 8765)
- Python Client: `integrations/python/unmask_client.py`
- Pairt mit playstealth-cli via CDP attach

## Graphify

- 214 nodes, 25 communities
- `graphify update .` nach Code-Änderungen
