# Graph Report - unmask-cli  (2026-05-01)

## Corpus Check
- 55 files · ~25,727 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 214 nodes · 320 edges · 17 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `UnmaskClient` - 21 edges
2. `Logger` - 11 edges
3. `QueueManager` - 10 edges
4. `StateStore` - 7 edges
5. `NetworkSniffer` - 7 edges
6. `ConsoleListener` - 7 edges
7. `Dispatcher` - 6 edges
8. `Session` - 6 edges
9. `act()` - 5 edges
10. `LLM` - 5 edges

## Surprising Connections (you probably didn't know these)
- `act()` --calls--> `selfHeal()`  [INFERRED]
  src/llm/act.ts → src/modules/selectors.ts
- `inspect()` --calls--> `emptyUnmaskResponse()`  [INFERRED]
  src/commands/inspect.ts → src/schemas/unmask.ts
- `inspect()` --calls--> `parseUnmaskResponse()`  [INFERRED]
  src/commands/inspect.ts → src/schemas/unmask.ts
- `extract()` --calls--> `serializeForLLM()`  [INFERRED]
  src/llm/extract.ts → src/llm/serialize.ts
- `act()` --calls--> `observe()`  [INFERRED]
  src/llm/act.ts → src/llm/observe.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (4): Telemetry, toEuros(), Notifier, post()

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (5): unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas, JSON-RPC 2.0 client over stdio., UnmaskClient, UnmaskRPCError, RuntimeError

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (9): act(), planFromText(), extract(), observe(), isLLMAvailable(), LLM, serializeForLLM(), DomScanner (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (7): mapOutcomeToStatus(), QueueManager, humanPause(), jitterMs(), microJitter(), randomInt(), sleep()

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (4): preScan(), Dispatcher, parse(), bundleSession()

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (12): applyStealthPatches(), launchBrowser(), runBrowser(), deriveSurveys(), extractCandidatesFromJson(), inspect(), parseFirstAmount(), pickAny() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.23
Nodes (2): colourPrefix(), Logger

### Community 7 - "Community 7"
Cohesion: 0.31
Nodes (2): ConsoleListener, mapLevel()

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (3): PanelDetector, RiskAssessor, TrapScanner

### Community 9 - "Community 9"
Cohesion: 0.46
Nodes (2): StateStore, emptyQueueState()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (1): NetworkSniffer

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (1): Session

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (1): ScreenshotTimeline

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): api(), main(), walk()

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (1): RewardEstimator

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (1): QuestionClassifier

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (2): ensureLabel(), gh()

## Knowledge Gaps
- **2 isolated node(s):** `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 6`** (12 nodes): `colourPrefix()`, `Logger`, `.child()`, `.constructor()`, `.debug()`, `.error()`, `.info()`, `.setJson()`, `.setLevel()`, `.setSilent()`, `.warn()`, `.write()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (9 nodes): `ConsoleListener`, `.attach()`, `.constructor()`, `.handle()`, `.push()`, `.results()`, `.tag()`, `mapLevel()`, `console.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (8 nodes): `StateStore`, `.appendBlacklist()`, `.constructor()`, `.ensureDir()`, `.load()`, `.loadBlacklist()`, `.save()`, `emptyQueueState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (7 nodes): `NetworkSniffer`, `.attach()`, `.constructor()`, `.detach()`, `.matchKeywords()`, `.results()`, `.topCandidates()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (6 nodes): `Session`, `.append()`, `.constructor()`, `.end()`, `.init()`, `.nextScreenshotPath()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (5 nodes): `ScreenshotTimeline`, `.capture()`, `.constructor()`, `.getEntries()`, `screenshot-timeline.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (4 nodes): `reward-estimator.ts`, `RewardEstimator`, `.estimate()`, `.rank()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (4 nodes): `question-classifier.ts`, `QuestionClassifier`, `.classify()`, `.primary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (3 nodes): `ensureLabel()`, `gh()`, `create-issues.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Logger` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `QueueManager` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `NetworkSniffer` connect `Community 10` to `Community 0`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._