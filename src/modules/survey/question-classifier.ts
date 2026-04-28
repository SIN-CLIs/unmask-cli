/**
 * Question Classifier — identifies question types on survey pages.
 *
 * Scans the DOM for radio buttons, checkboxes, sliders, matrices,
 * text fields, dropdowns, and other question patterns. This feeds
 * into playstealth-cli's question_router for optimal answer strategy.
 */
import type { Page } from "playwright";

export type QuestionType =
  | "radio"
  | "checkbox"
  | "matrix"
  | "slider"
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "date"
  | "rank_order"
  | "consent"
  | "unknown";

export interface QuestionInfo {
  type: QuestionType;
  count: number;
  selectors: string[];
  label?: string;
}

export class QuestionClassifier {
  async classify(page: Page): Promise<QuestionInfo[]> {
    const questions: QuestionInfo[] = [];

    const checks: Array<{
      type: QuestionType;
      selector: string;
      label?: string;
    }> = [
      { type: "slider", selector: 'input[type="range"]' },
      { type: "date", selector: 'input[type="date"]' },
      { type: "number", selector: 'input[type="number"], input[inputmode="numeric"]' },
      { type: "select", selector: "select" },
      { type: "textarea", selector: "textarea" },
      { type: "text", selector: 'input[type="text"], input:not([type])' },
      { type: "radio", selector: 'input[type="radio"]' },
      { type: "checkbox", selector: 'input[type="checkbox"]' },
      { type: "matrix", selector: 'table.question, [class*="matrix"], [class*="grid"], [data-question-type="matrix"]' },
      { type: "rank_order", selector: '[class*="rank-order"], [data-question-type="rank-order"]' },
      { type: "consent", selector: 'button:has-text("Accept"), button:has-text("Akzeptieren"), button:has-text("Agree")' },
    ];

    for (const check of checks) {
      try {
        const count = await page.locator(check.selector).count();
        if (count > 0) {
          questions.push({
            type: check.type,
            count,
            selectors: [check.selector],
            label: check.label,
          });
        }
      } catch {
        // skip invalid selector
      }
    }

    // If no known types found, mark as unknown
    if (questions.length === 0) {
      questions.push({
        type: "unknown",
        count: 0,
        selectors: ["body"],
        label: "No known question type detected",
      });
    }

    return questions;
  }

  /** Get the primary question type (first non-consent type) */
  primary(questions: QuestionInfo[]): QuestionType {
    const nonConsent = questions.filter((q) => q.type !== "consent");
    return nonConsent[0]?.type ?? "unknown";
  }
}
