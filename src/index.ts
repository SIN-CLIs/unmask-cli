/**
 * Public library entry point.
 *
 * Use this when you want to embed unmask-cli's modules into your own
 * automation script instead of going through the CLI.
 */
export * from './schemas/index.js';
export { launchBrowser, applyStealthPatches } from './browser/runner.js';
export type { RunnerOptions, RunnerHandle } from './browser/runner.js';
export { NetworkSniffer } from './modules/network.js';
export type { NetworkSnifferOptions } from './modules/network.js';
export { DomScanner } from './modules/dom.js';
export type { DomScannerOptions } from './modules/dom.js';
export { ConsoleListener } from './modules/console.js';
export type { ConsoleListenerOptions } from './modules/console.js';
export { selfHeal } from './modules/selectors.js';
export type { SelfHealOptions, SelfHealResult } from './modules/selectors.js';
export { StateStore } from './queue/state.js';
export type { StateStoreOptions } from './queue/state.js';
export { QueueManager } from './queue/manager.js';
export type {
  QueueManagerOptions,
  SurveyOutcome,
  SurveyResult,
  SurveyRunner,
} from './queue/manager.js';
export { inspect } from './commands/inspect.js';
export type { InspectOptions } from './commands/inspect.js';
export { microJitter, humanPause, jitterMs, sleep, randomInt } from './utils/jitter.js';
export { Logger, logger } from './utils/logger.js';
