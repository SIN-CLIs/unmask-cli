# Graph Report - unmask-cli  (2026-05-03)

## Corpus Check
- 59 files · ~29,678 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 243 nodes · 366 edges · 22 communities detected
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `UnmaskClient` - 21 edges
2. `Logger` - 11 edges
3. `MacOSAXBridge` - 11 edges
4. `QueueManager` - 10 edges
5. `ScreenClassifier` - 10 edges
6. `StateStore` - 7 edges
7. `NetworkSniffer` - 7 edges
8. `ConsoleListener` - 7 edges
9. `Dispatcher` - 6 edges
10. `Session` - 6 edges

## Surprising Connections (you probably didn't know these)
- `act()` --calls--> `selfHeal()`  [INFERRED]
  src/llm/act.ts → src/modules/selectors.ts
- `emptyUnmaskResponse()` --calls--> `inspect()`  [INFERRED]
  src/schemas/unmask.ts → src/commands/inspect.ts
- `parseUnmaskResponse()` --calls--> `inspect()`  [INFERRED]
  src/schemas/unmask.ts → src/commands/inspect.ts
- `extract()` --calls--> `serializeForLLM()`  [INFERRED]
  src/llm/extract.ts → src/llm/serialize.ts
- `act()` --calls--> `observe()`  [INFERRED]
  src/llm/act.ts → src/llm/observe.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (1): emptyQueueState()

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (5): unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas, JSON-RPC 2.0 client over stdio., UnmaskClient, UnmaskRPCError, RuntimeError

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (7): mapOutcomeToStatus(), QueueManager, humanPause(), jitterMs(), microJitter(), randomInt(), sleep()

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (4): handler(), createClassifier(), RUN_APPLESCRIPT(), ScreenClassifier

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (9): preScan(), Dispatcher, parse(), act(), planFromText(), extract(), observe(), serializeForLLM() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (12): applyStealthPatches(), launchBrowser(), runBrowser(), deriveSurveys(), extractCandidatesFromJson(), inspect(), parseFirstAmount(), pickAny() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.23
Nodes (2): colourPrefix(), Logger

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (2): bundleSession(), Session

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (1): MacOSAXBridge

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (3): PanelDetector, RiskAssessor, TrapScanner

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (3): visionFallback(), isLLMAvailable(), LLM

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (2): Telemetry, toEuros()

### Community 12 - "Community 12"
Cohesion: 0.32
Nodes (2): ConsoleListener, mapLevel()

### Community 13 - "Community 13"
Cohesion: 0.57
Nodes (1): StateStore

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (1): NetworkSniffer

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): ScreenshotTimeline

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): api(), main(), walk()

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (2): Notifier, post()

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (1): RewardEstimator

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (1): QuestionClassifier

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (2): ensureLabel(), gh()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (1): DomScanner

## Knowledge Gaps
- **2 isolated node(s):** `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 0`** (39 nodes): `runHttpServer()`, `runStdioServer()`, `createPlaywrightSurveyRunner()`, `outcome()`, `emptyQueueState()`, `emit()`, `pickMixed()`, `cli.ts`, `macos-ax-bridge.ts`, `dispatch.ts`, `http.ts`, `stdio.ts`, `act.ts`, `extract.ts`, `observe.ts`, `provider.ts`, `serialize.ts`, `console.ts`, `dom.ts`, `network.ts`, `selectors.ts`, `manager.ts`, `playwright-runner.ts`, `state.ts`, `queue.ts`, `unmask.ts`, `logger.ts`, `notify.ts`, `dispatch.test.ts`, `e2e.test.ts`, `notify.test.ts`, `survey()`, `playwright-runner.test.ts`, `survey()`, `queue.test.ts`, `schemas.test.ts`, `fakePage()`, `serialize.test.ts`, `state.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (12 nodes): `colourPrefix()`, `Logger`, `.child()`, `.constructor()`, `.debug()`, `.error()`, `.info()`, `.setJson()`, `.setLevel()`, `.setSilent()`, `.warn()`, `.write()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (11 nodes): `bundleSession()`, `sessionArtifactPaths()`, `Session`, `.append()`, `.constructor()`, `.end()`, `.init()`, `.nextScreenshotPath()`, `bundle.ts`, `session.ts`, `bundle.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (11 nodes): `MacOSAXBridge`, `.clickElement()`, `.constructor()`, `.filterWindows()`, `.findText()`, `.getElements()`, `.getWindowsByPid()`, `.listWindows()`, `.runAXCommand()`, `.screenshotLabeled()`, `.setValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (8 nodes): `Telemetry`, `.recordResult()`, `.summary()`, `.toJSONL()`, `toEuros()`, `telemetry.ts`, `survey()`, `telemetry.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (8 nodes): `ConsoleListener`, `.attach()`, `.constructor()`, `.handle()`, `.push()`, `.results()`, `.tag()`, `mapLevel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (7 nodes): `StateStore`, `.appendBlacklist()`, `.constructor()`, `.ensureDir()`, `.load()`, `.loadBlacklist()`, `.save()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (7 nodes): `NetworkSniffer`, `.attach()`, `.constructor()`, `.detach()`, `.matchKeywords()`, `.results()`, `.topCandidates()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (5 nodes): `ScreenshotTimeline`, `.capture()`, `.constructor()`, `.getEntries()`, `screenshot-timeline.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (4 nodes): `Notifier`, `.constructor()`, `.send()`, `post()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (4 nodes): `reward-estimator.ts`, `RewardEstimator`, `.estimate()`, `.rank()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (4 nodes): `question-classifier.ts`, `QuestionClassifier`, `.classify()`, `.primary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (3 nodes): `ensureLabel()`, `gh()`, `create-issues.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (3 nodes): `DomScanner`, `.constructor()`, `.scan()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MacOSAXBridge` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `Logger` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `QueueManager` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `unmask_client.py — minimal Python JSON-RPC client for unmask-cli.  Spawns `unmas`, `JSON-RPC 2.0 client over stdio.` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._