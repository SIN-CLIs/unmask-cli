/**
 * Public programmatic API for `unmask-cli`. Anything exported here is part of
 * the supported surface that users — and the Python `playstealth-cli` runner
 * via JSON-RPC — depend on.
 */

// schemas
export * from './schemas/index.js';

// browser runner
export { launchBrowser, runBrowser, applyStealthPatches } from './browser/runner.js';
export type { RunnerOptions, RunnerHandle, RunBrowserOptions, RunBrowserHandle } from './browser/runner.js';

// modules
export { NetworkSniffer } from './modules/network.js';
export type { NetworkSnifferOptions } from './modules/network.js';
export { DomScanner } from './modules/dom.js';
export type { DomScannerOptions } from './modules/dom.js';
export { ConsoleListener } from './modules/console.js';
export type { ConsoleListenerOptions } from './modules/console.js';
export { selfHeal } from './modules/selectors.js';
export type { SelfHealOptions, SelfHealResult } from './modules/selectors.js';

// queue
export { QueueManager } from './queue/manager.js';
export type {
  QueueManagerOptions,
  SurveyOutcome,
  SurveyResult,
  SurveyRunner,
} from './queue/manager.js';
export { StateStore } from './queue/state.js';
export type { StateStoreOptions } from './queue/state.js';
export { Telemetry } from './queue/telemetry.js';
export type { TelemetrySample, TelemetrySummary } from './queue/telemetry.js';
export { createPlaywrightSurveyRunner } from './queue/playwright-runner.js';
export type { PlaywrightRunnerOptions } from './queue/playwright-runner.js';

// session + replay
export { Session } from './session/session.js';
export type { SessionEvent, SessionInit } from './session/session.js';
export { bundleSession, sessionArtifactPaths } from './replay/bundle.js';

// llm
export { LLM, isLLMAvailable } from './llm/provider.js';
export type { LLMConfig } from './llm/provider.js';
export { observe } from './llm/observe.js';
export type { ObserveOptions, ObserveCandidate } from './llm/observe.js';
export { extract } from './llm/extract.js';
export type { ExtractOptions } from './llm/extract.js';
export { act } from './llm/act.js';
export type { ActOptions, ActPlan, ActResult, ActVerb } from './llm/act.js';
export { serializeForLLM } from './llm/serialize.js';
export type { SerializedTree } from './llm/serialize.js';

// ipc
export { Dispatcher, RpcRequestSchema } from './ipc/dispatch.js';
export type { RpcRequest, RpcResponse, RpcSuccess, RpcError } from './ipc/dispatch.js';
export { runStdioServer } from './ipc/stdio.js';
export { runHttpServer } from './ipc/http.js';
export type { HttpServerOptions } from './ipc/http.js';

// commands
export { inspect } from './commands/inspect.js';
export type { InspectOptions } from './commands/inspect.js';

// utils
export { Notifier } from './utils/notify.js';
export type { NotifyOptions, NotifyPayload, NotifyLevel } from './utils/notify.js';
export { Logger, logger } from './utils/logger.js';
export { microJitter, humanPause, jitterMs, sleep, randomInt } from './utils/jitter.js';
export { preScan } from './commands/pre-scan.js';
export type { PreScanResult, PreScanElement } from './commands/pre-scan.js';
export { ScreenshotTimeline } from "./commands/screenshot-timeline.js";
