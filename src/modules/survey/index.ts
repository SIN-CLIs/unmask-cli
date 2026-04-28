/**
 * Barrel export for survey-specific scanner modules.
 *
 * These five modules form the "X-ray vision" that analyzes a survey page
 * BEFORE playstealth-cli interacts with it:
 *
 *   panel-detector    → which panel engine is this?
 *   trap-scanner      → what traps/honeypots are on this page?
 *   reward-estimator  → how much does this survey pay?
 *   risk-assessor     → how likely is a DQ?
 *   question-classifier → what question types are on this page?
 */
export { PanelDetector } from "./panel-detector.js";
export type { PanelId, PanelInfo } from "./panel-detector.js";

export { TrapScanner } from "./trap-scanner.js";
export type { TrapInfo } from "./trap-scanner.js";

export { RewardEstimator } from "./reward-estimator.js";
export type { RewardInfo } from "./reward-estimator.js";

export { RiskAssessor } from "./risk-assessor.js";
export type { RiskAssessment } from "./risk-assessor.js";

export { QuestionClassifier } from "./question-classifier.js";
export type { QuestionType, QuestionInfo } from "./question-classifier.js";
