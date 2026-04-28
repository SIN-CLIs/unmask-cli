/**
 * Risk Assessor — predicts disqualification probability.
 *
 * Uses heuristics to estimate how likely a survey is to DQ you:
 *   - Screener question count
 *   - Panel reputation (some panels DQ more aggressively)
 *   - Attention check presence
 *   - Open-ended question count
 *   - Historical DQ rate for this panel
 */
import type { PanelId } from "./panel-detector.js";
import type { TrapInfo } from "./trap-scanner.js";

export interface RiskAssessment {
  dqProbability: number; // 0..1
  riskLevel: "low" | "medium" | "high";
  factors: string[];
  estimatedTimeWaste: number; // minutes of wasted time if DQ'd midway
}

// Panel DQ reputation scores (lower = more DQs)
const PANEL_DQ_REPUTATION: Partial<Record<PanelId, number>> = {
  dynata: 0.3,
  cint: 0.25,
  lucid: 0.2,
  purespectrum: 0.35,
  sapio: 0.4,
  qualtrics: 0.15,
  decipher: 0.2,
  unknown: 0.3,
};

export class RiskAssessor {
  assess(
    panelId: PanelId,
    traps: TrapInfo[],
    screenerCount: number = 0,
    openEndedCount: number = 0
  ): RiskAssessment {
    const factors: string[] = [];
    let riskScore = 0;
    let maxScore = 0;

    // Panel reputation
    const panelRisk = PANEL_DQ_REPUTATION[panelId] ?? 0.3;
    riskScore += panelRisk * 3;
    maxScore += 3;
    if (panelRisk > 0.25) {
      factors.push(`Panel "${panelId}" has higher DQ rate`);
    }

    // Screener questions
    if (screenerCount > 0) {
      const screenerFactor = Math.min(screenerCount / 5, 1);
      riskScore += screenerFactor * 2;
      maxScore += 2;
      factors.push(`${screenerCount} screener question(s)`);
    }

    // Attention checks
    const attentionTraps = traps.filter((t) => t.type === "attention_check");
    if (attentionTraps.length > 0) {
      riskScore += attentionTraps.length * 1.5;
      maxScore += attentionTraps.length * 1.5;
      factors.push(`${attentionTraps.length} attention check(s)`);
    }

    // Honeypots
    const honeypots = traps.filter((t) => t.type === "honeypot");
    if (honeypots.length > 0) {
      riskScore += honeypots.length * 1;
      maxScore += honeypots.length;
      factors.push(`${honeypots.length} honeypot(s)`);
    }

    // Open-ended questions (harder to answer correctly)
    if (openEndedCount > 0) {
      riskScore += Math.min(openEndedCount / 3, 1) * 1.5;
      maxScore += 1.5;
      factors.push(`${openEndedCount} open-ended question(s)`);
    }

    const dqProbability = maxScore > 0 ? riskScore / maxScore : 0.1;

    let riskLevel: "low" | "medium" | "high";
    if (dqProbability > 0.5) riskLevel = "high";
    else if (dqProbability > 0.25) riskLevel = "medium";
    else riskLevel = "low";

    return {
      dqProbability: Math.round(dqProbability * 100) / 100,
      riskLevel,
      factors,
      estimatedTimeWaste: dqProbability * 3, // rough estimate: 3 min avg survey
    };
  }
}
