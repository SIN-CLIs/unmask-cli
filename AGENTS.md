# AGENTS.md — unmask-cli

**SENSE** component of Stealth Triade: X-ray vision for web pages.
Install: `npm install -g unmask-cli` | Start: `unmask serve --http`
API: JSON-RPC 2.0. Methods: `dom.scan`, `console.list`, `network.list`

## 🔗 Stealth Suite

- **Orchestrator:** [stealth-runner](https://github.com/SIN-CLIs/stealth-runner)
- **HIDE:** [playstealth-cli](https://github.com/SIN-CLIs/playstealth-cli)
- **ACT:** [skylight-cli](https://github.com/SIN-CLIs/skylight-cli)
- **VERIFY:** [screen-follow](https://github.com/SIN-CLIs/screen-follow)
- **Vision:** NVIDIA Nemotron 3 Nano Omni (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
