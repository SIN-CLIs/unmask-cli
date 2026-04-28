/**
 * Reward Estimator — extracts monetary reward information from survey pages.
 *
 * HeyPiggy surveys show EUR amounts, time estimates, and sometimes coin
 * values. This module finds those signals and calculates EUR/hour and
 * EUR/minute values for survey prioritization.
 */
import type { Page } from "playwright";

export interface RewardInfo {
  amountEur: number | null;
  timeMinutes: number | null;
  eurPerHour: number | null;
  eurPerMinute: number | null;
  currency: string;
  confidence: number; // 0..1
  rawText: string;
}

export class RewardEstimator {
  private readonly timePattern = /(\d+)\s*(?:Minute|Min\.?|Minuten?|minute|min\.?)/i;
  private readonly eurPattern = /(?:€|EUR)\s*(\d+[.,]\d{1,2})|(\d+[.,]\d{1,2})\s*(?:€|EUR)/i;

  async estimate(page: Page): Promise<RewardInfo> {
    const result: RewardInfo = {
      amountEur: null,
      timeMinutes: null,
      eurPerHour: null,
      eurPerMinute: null,
      currency: "EUR",
      confidence: 0,
      rawText: "",
    };

    try {
      const locator = page.locator(
        'span, div, p, .reward, .amount, .time, [class*="reward"], [class*="price"], [class*="amount"], [class*="duration"]'
      );
      const texts = await locator.allInnerTexts();

      const combined = texts.join("\n");
      result.rawText = combined.slice(0, 200);
      let sigCount = 0;

      // Extract EUR amount
      const eurMatch = combined.match(this.eurPattern);
      if (eurMatch) {
        const val = parseFloat(
          (eurMatch[1] || eurMatch[2]).replace(",", ".")
        );
        if (!isNaN(val)) {
          result.amountEur = Math.round(val * 100) / 100;
          sigCount++;
        }
      }

      // Extract time
      const timeMatch = combined.match(this.timePattern);
      if (timeMatch) {
        result.timeMinutes = parseInt(timeMatch[1], 10);
        sigCount++;
      }

      // Calculate EUR/h
      if (result.amountEur !== null && result.timeMinutes !== null) {
        if (result.timeMinutes > 0) {
          result.eurPerHour = Math.round(
            (result.amountEur / result.timeMinutes) * 60 * 100
          ) / 100;
          result.eurPerMinute = Math.round(
            (result.amountEur / result.timeMinutes) * 100
          ) / 100;
          sigCount++;
        }
      }

      result.confidence = Math.min(1.0, sigCount * 0.33);
    } catch {
      // page content not accessible
    }

    return result;
  }

  /** Rank surveys by EUR/hour (descending). */
  rank(rewards: RewardInfo[]): RewardInfo[] {
    return [...rewards].sort((a, b) => {
      const aVal = a.eurPerHour ?? -1;
      const bVal = b.eurPerHour ?? -1;
      return bVal - aVal;
    });
  }
}
