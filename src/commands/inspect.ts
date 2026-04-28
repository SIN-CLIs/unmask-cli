/**
 * `unmask inspect <url>` — runs all three modules (network, dom, console) on
 * the given URL and emits a single SOTA UnmaskResponse JSON document.
 */
import type { Page } from 'playwright';
import { launchBrowser, type RunnerOptions } from '../browser/runner.js';
import { ConsoleListener } from '../modules/console.js';
import { DomScanner } from '../modules/dom.js';
import { NetworkSniffer } from '../modules/network.js';
import {
  emptyUnmaskResponse,
  parseUnmaskResponse,
  type Survey,
  type UnmaskResponse,
} from '../schemas/unmask.js';
import { logger } from '../utils/logger.js';

export interface InspectOptions extends RunnerOptions {
  url: string;
  waitForSelector?: string;
  waitMs?: number;
  /** Only return network captures that matched at least one keyword. */
  onlyMatchedNetwork?: boolean;
  /** Save a screenshot to this path before closing. */
  screenshotPath?: string;
}

export async function inspect(opts: InspectOptions): Promise<UnmaskResponse> {
  const start = Date.now();
  const out = emptyUnmaskResponse(opts.url);

  const sniffer = new NetworkSniffer({ onlyMatched: opts.onlyMatchedNetwork });
  const consoleListener = new ConsoleListener();
  const scanner = new DomScanner();

  const handle = await launchBrowser(opts);
  try {
    const page = handle.page;
    consoleListener.attach(page);
    await sniffer.attach(page);

    logger.info('inspect: navigating', { url: opts.url });
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    if (opts.waitForSelector) {
      try {
        await page.waitForSelector(opts.waitForSelector, { timeout: 15_000 });
      } catch (err) {
        out.errors.push(
          `waitForSelector("${opts.waitForSelector}") timed out: ${(err as Error).message}`,
        );
      }
    }

    if (opts.waitMs && opts.waitMs > 0) {
      await page.waitForTimeout(opts.waitMs);
    } else {
      // Best-effort idle wait but don't fail the run if the page never settles.
      try {
        await page.waitForLoadState('networkidle', { timeout: 8_000 });
      } catch {
        /* ignore */
      }
    }

    const dom = await scanner.scan(page);
    out.dom = dom;
    out.network = sniffer.results();
    out.console = consoleListener.results();
    out.surveys = deriveSurveys(out, page);

    if (opts.screenshotPath) {
      try {
        await page.screenshot({ path: opts.screenshotPath, fullPage: true });
      } catch (err) {
        out.errors.push(`screenshot failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    out.errors.push(`inspect error: ${(err as Error).message}`);
    out.status = 'error';
  } finally {
    await sniffer.detach();
    await handle.close();
  }

  out.durationMs = Date.now() - start;
  if (out.errors.length > 0 && out.status === 'success') out.status = 'partial';

  // Validate before returning so we never emit a bad payload.
  return parseUnmaskResponse(out);
}

/**
 * Heuristic to derive Surveys from network + DOM captures.
 *
 * The agent does NOT need a perfect parser here: the queue worker re-validates
 * each Survey before clicking. We simply project the strongest candidates into
 * the schema so the JSON is immediately consumable.
 */
function deriveSurveys(res: UnmaskResponse, _page: Page): Survey[] {
  const surveys: Survey[] = [];

  // 1. From network: any JSON object that contains an "id" + "reward"-like field.
  for (const cap of res.network) {
    if (!cap.json) continue;
    const items = extractCandidatesFromJson(cap.json);
    for (const it of items) {
      surveys.push({
        id: String(it.id),
        reward: { amount: Number(it.amount ?? 0), currency: String(it.currency ?? 'EUR') },
        ...(typeof it.duration === 'number' ? { durationMinutes: it.duration } : {}),
        confidence: 0.9,
        selector: `[data-id="${String(it.id)}"]`,
        fallbackSelectors: [`#${String(it.id)}`, `[data-survey-id="${String(it.id)}"]`],
        actionType: 'click',
        ...(it.label ? { semantic: { ariaLabel: String(it.label) } } : {}),
        metadata: { source: 'network', sourceUrl: cap.url },
      });
    }
  }

  // 2. From DOM candidates that look like card/button with price.
  let i = 0;
  for (const cand of res.dom) {
    const hasPrice = cand.reasons.includes('price-text') || cand.reasons.includes('price-in-text');
    if (!hasPrice) continue;
    const id = `dom-${i++}`;
    const amount = parseFirstAmount(cand.text || '');
    surveys.push({
      id,
      reward: { amount, currency: 'EUR' },
      confidence: cand.confidence,
      selector: cand.selector,
      fallbackSelectors: cand.fallbackSelectors,
      actionType: 'click',
      semantic: {
        ...(cand.role ? { role: cand.role } : {}),
        ...(cand.ariaLabel ? { ariaLabel: cand.ariaLabel } : {}),
        ...(cand.text ? { text: cand.text } : {}),
      },
      metadata: { source: 'dom' },
    });
  }

  // De-dup by id, keep first.
  const seen = new Set<string>();
  return surveys.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

interface CandidateItem {
  id: string | number;
  amount?: number;
  currency?: string;
  duration?: number;
  label?: string;
}

function extractCandidatesFromJson(node: unknown, acc: CandidateItem[] = []): CandidateItem[] {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) extractCandidatesFromJson(item, acc);
    return acc;
  }
  const obj = node as Record<string, unknown>;
  const id = pickAny(obj, ['id', 'survey_id', 'surveyId', 'offerId', 'offer_id']);
  if (id != null) {
    const amount = pickNumber(obj, ['price', 'reward', 'amount', 'payout', 'value']);
    const currency = pickString(obj, ['currency', 'curr', 'currencyCode']);
    const duration = pickNumber(obj, ['duration', 'minutes', 'lengthMinutes', 'time_minutes']);
    const label = pickString(obj, ['title', 'label', 'name']);
    if (typeof id === 'string' || typeof id === 'number') {
      acc.push({
        id,
        ...(amount != null ? { amount } : {}),
        ...(currency != null ? { currency } : {}),
        ...(duration != null ? { duration } : {}),
        ...(label != null ? { label } : {}),
      });
    }
  }
  for (const v of Object.values(obj)) extractCandidatesFromJson(v, acc);
  return acc;
}

function pickAny(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (k in o) return o[k];
  return undefined;
}
function pickNumber(o: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}
function pickString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

function parseFirstAmount(text: string): number {
  const m = text.match(/(\d+[.,]\d{1,2})\s*(€|EUR|\$|USD|£|GBP)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]!.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
