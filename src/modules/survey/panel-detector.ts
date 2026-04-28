/**
 * Panel Detector — identifies which survey panel engine is running.
 *
 * HeyPiggy doesn't run surveys itself — it redirects to third-party panels.
 * Each panel has distinct DOM signatures, URL patterns, and behavioral
 * characteristics. This module fingerprints the active panel.
 */
import type { Page } from "playwright";

export type PanelId =
  | "dynata"
  | "cint"
  | "lucid"
  | "purespectrum"
  | "sapio"
  | "qualtrics"
  | "decipher"
  | "unknown";

export interface PanelInfo {
  id: PanelId;
  confidence: number; // 0..1
  signals: string[];
  urlFragment: string;
}

const PANEL_FINGERPRINTS: Record<
  Exclude<PanelId, "unknown">,
  { domains: string[]; selectors: string[]; urlTokens: string[] }
> = {
  dynata: {
    domains: ["dynata.com", "sawtoothsoftware.com"],
    selectors: [
      '[id*="Dynata"]',
      '[class*="dynata"]',
      'script[src*="dynata"]',
    ],
    urlTokens: ["dynata", "sawtooth"],
  },
  cint: {
    domains: ["cint.com", "cintworks.com"],
    selectors: ['[id*="cint"]', '[class*="cint"]', 'script[src*="cint"]'],
    urlTokens: ["cint", "cintworks"],
  },
  lucid: {
    domains: ["luc.id", "lucidhq.com", "fulcrum.com"],
    selectors: [
      '[id*="lucid"]',
      '[class*="lucid"]',
      'script[src*="lucid"]',
    ],
    urlTokens: ["lucid", "fulcrum", "luc.id"],
  },
  purespectrum: {
    domains: ["purespectrum.com", "puresurvey.com"],
    selectors: [
      '[id*="PureSpectrum"]',
      '[class*="purespectrum"]',
      'script[src*="purespectrum"]',
    ],
    urlTokens: ["purespectrum", "puresurvey"],
  },
  sapio: {
    domains: ["sapioresearch.com", "sapiosurveys.com"],
    selectors: [
      '[id*="sapio"]',
      '[class*="sapio"]',
      'script[src*="sapio"]',
    ],
    urlTokens: ["sapio", "sapioresearch"],
  },
  qualtrics: {
    domains: ["qualtrics.com"],
    selectors: [
      '[id*="QSI"]',
      '[class*="Skin"]',
      'script[src*="qualtrics"]',
      "#Questions",
    ],
    urlTokens: ["qualtrics", "jfe", "SV_"],
  },
  decipher: {
    domains: ["decipherinc.com", "confirmit.com"],
    selectors: [
      '[id*="survey"]',
      '[class*="decipher"]',
      'script[src*="decipher"]',
    ],
    urlTokens: ["decipher", "confirmit"],
  },
};

export class PanelDetector {
  async detect(page: Page): Promise<PanelInfo> {
    const url = page.url().toLowerCase();
    const signals: string[] = [];

    // Check domains and URL tokens
    for (const [panelId, fp] of Object.entries(PANEL_FINGERPRINTS)) {
      for (const domain of fp.domains) {
        if (url.includes(domain)) {
          signals.push(`domain:${domain}`);
        }
      }
      for (const token of fp.urlTokens) {
        if (url.includes(token)) {
          signals.push(`url:${token}`);
        }
      }
      // Check DOM selectors
      for (const sel of fp.selectors) {
        try {
          const count = await page.locator(sel).count();
          if (count > 0) {
            signals.push(`dom:${sel}`);
          }
        } catch {
          // selector not valid, skip
        }
      }

      if (signals.length >= 2) {
        return {
          id: panelId as PanelId,
          confidence: Math.min(1.0, signals.length * 0.3),
          signals: [...new Set(signals)],
          urlFragment: url.slice(0, 80),
        };
      }
      signals.length = 0;
    }

    return {
      id: "unknown",
      confidence: 0.1,
      signals: [`url:${url.slice(0, 60)}`],
      urlFragment: url.slice(0, 80),
    };
  }
}
