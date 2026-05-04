# Graph Report - unmask-cli  (2026-05-04)

## Corpus Check
- 60 files · ~30,526 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 245 nodes · 370 edges · 20 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]

## God Nodes (most connected - your core abstractions)
1. `UnmaskClient` - 21 edges
2. `Logger` - 11 edges
3. `MacOSAXBridge` - 11 edges
4. `QueueManager` - 10 edges
5. `ScreenClassifier` - 10 edges
6. `NetworkSniffer` - 8 edges
7. `StateStore` - 7 edges
8. `ConsoleListener` - 7 edges
9. `Dispatcher` - 6 edges
10. `Session` - 6 edges

## Surprising Connections (you probably didn't know these)
- `act()` --calls--> `observe()`  [INFERRED]
  src/llm/act.ts → src/llm/observe.ts
- `act()` --calls--> `selfHeal()`  [INFERRED]
  src/llm/act.ts → src/modules/selectors.ts
- `emptyUnmaskResponse()` --calls--> `inspect()`  [INFERRED]
  src/schemas/unmask.ts → src/commands/inspect.ts
- `parseUnmaskResponse()` --calls--> `inspect()`  [INFERRED]
  src/schemas/unmask.ts → src/commands/inspect.ts
- `extract()` --calls--> `serializeForLLM()`  [INFERRED]
  src/llm/extract.ts → src/llm/serialize.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (5): unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas, JSON-RPC 2.0 client over stdio., UnmaskClient, UnmaskRPCError, RuntimeError

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (13): applyStealthPatches(), launchBrowser(), runBrowser(), deriveSurveys(), extractCandidatesFromJson(), inspect(), parseFirstAmount(), pickAny() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (5): act(), planFromText(), selfHeal(), colourPrefix(), Logger

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (4): preScan(), Dispatcher, parse(), bundleSession()

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (6): visionFallback(), extract(), observe(), isLLMAvailable(), LLM, serializeForLLM()

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (7): mapOutcomeToStatus(), QueueManager, humanPause(), jitterMs(), microJitter(), randomInt(), sleep()

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (4): handler(), createClassifier(), RUN_APPLESCRIPT(), ScreenClassifier

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (2): StateStore, emptyQueueState()

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (1): MacOSAXBridge

### Community 9 - "Community 9"
Cohesion: 0.31
Nodes (2): ConsoleListener, mapLevel()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (3): PanelDetector, RiskAssessor, TrapScanner

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (2): Telemetry, toEuros()

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (1): NetworkSniffer

### Community 13 - "Community 13"
Cohesion: 0.47
Nodes (1): Session

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (2): Notifier, post()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): ScreenshotTimeline

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): api(), main(), walk()

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (1): RewardEstimator

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (1): QuestionClassifier

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (2): ensureLabel(), gh()

## Knowledge Gaps
- **2 isolated node(s):** `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (15 nodes): `StateStore`, `.appendBlacklist()`, `.constructor()`, `.ensureDir()`, `.load()`, `.loadBlacklist()`, `.save()`, `emptyQueueState()`, `manager.ts`, `state.ts`, `queue.ts`, `survey()`, `queue.test.ts`, `schemas.test.ts`, `state.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (11 nodes): `MacOSAXBridge`, `.clickElement()`, `.constructor()`, `.filterWindows()`, `.findText()`, `.getElements()`, `.getWindowsByPid()`, `.listWindows()`, `.runAXCommand()`, `.screenshotLabeled()`, `.setValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (9 nodes): `ConsoleListener`, `.attach()`, `.constructor()`, `.handle()`, `.push()`, `.results()`, `.tag()`, `mapLevel()`, `console.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (8 nodes): `Telemetry`, `.recordResult()`, `.summary()`, `.toJSONL()`, `toEuros()`, `telemetry.ts`, `survey()`, `telemetry.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (8 nodes): `NetworkSniffer`, `.attach()`, `.constructor()`, `.detach()`, `.matchKeywords()`, `.results()`, `.toHar()`, `.topCandidates()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (6 nodes): `Session`, `.append()`, `.constructor()`, `.end()`, `.init()`, `.nextScreenshotPath()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (6 nodes): `notify.ts`, `notify.test.ts`, `Notifier`, `.constructor()`, `.send()`, `post()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (5 nodes): `ScreenshotTimeline`, `.capture()`, `.constructor()`, `.getEntries()`, `screenshot-timeline.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (4 nodes): `reward-estimator.ts`, `RewardEstimator`, `.estimate()`, `.rank()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (4 nodes): `question-classifier.ts`, `QuestionClassifier`, `.classify()`, `.primary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (3 nodes): `ensureLabel()`, `gh()`, `create-issues.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MacOSAXBridge` connect `Community 8` to `Community 1`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `QueueManager` connect `Community 5` to `Community 7`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._