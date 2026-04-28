/**
 * Trap Scanner — detects honeypots, attention checks, and DQ traps.
 *
 * Survey panels insert deliberate traps to catch bots:
 *   - Honeypots: invisible inputs that bots fill but humans don't
 *   - Attention checks: "select the third option" instructions
 *   - Consistency traps: repeat questions that must match
 *   - Speed traps: questions answered impossibly fast
 */
import type { Page } from "playwright";

export interface TrapInfo {
  type: "honeypot" | "attention_check" | "consistency_trap" | "speed_trap";
  severity: "low" | "medium" | "high";
  selector?: string;
  instruction?: string;
  description: string;
}

const ATTENTION_CHECK_PATTERNS = [
  /(?:select|choose|click|pick|mark)\s+(?:the\s+)?(first|second|third|fourth|fifth|last)\s+option/i,
  /(?:wählen|klicken)\s+(?:sie\s+)?(?:die\s+)?(erste|zweite|dritte|vierte|fünfte|letzte)\s+option/i,
  /(?:bitte|please)\s+(?:wählen|select|choose|antworten)\s+(?:sie|you)?/i,
  /(?:attention|aufmerksamkeit|aufmerksam)\s*(?:check|prüfung|test)/i,
  /this\s+is\s+(?:an?\s+)?(?:attention|trap)\s+check/i,
];

export class TrapScanner {
  async scan(page: Page): Promise<TrapInfo[]> {
    const traps: TrapInfo[] = [];

    // 1. Scan for honeypot elements
    const honeypotSelectors = [
      'input[type="text"][style*="display: none"]',
      'input[type="text"][style*="display:none"]',
      "input[tabindex=\"-1\"][aria-hidden=\"true\"]",
      ".honeypot",
      "#honeypot",
      '[name*="hp_"]',
      '[id*="honeypot"]',
    ];

    for (const sel of honeypotSelectors) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) {
          traps.push({
            type: "honeypot",
            severity: "high",
            selector: sel,
            description: `Honeypot input detected: ${sel}`,
          });
        }
      } catch {
        // skip invalid selector
      }
    }

    // 2. Scan visible text for attention checks
    try {
      const bodyText = await page.innerText("body", { timeout: 3000 });
      for (const pattern of ATTENTION_CHECK_PATTERNS) {
        const match = bodyText.match(pattern);
        if (match) {
          traps.push({
            type: "attention_check",
            severity: "high",
            instruction: match[0],
            description: `Attention check instruction: "${match[0]}"`,
          });
          break; // one attention check is enough to flag
        }
      }

      // 3. Check for consistency trap indicators (repeat questions)
      const questions = bodyText.match(/(?:question|frage)[\s:]*\d+/gi);
      if (questions && questions.length > 1) {
        const unique = new Set(questions.map((q) => q.toLowerCase()));
        if (unique.size < questions.length) {
          traps.push({
            type: "consistency_trap",
            severity: "medium",
            description: "Duplicate question numbering detected",
          });
        }
      }
    } catch {
      // body text not available
    }

    return traps;
  }
}
