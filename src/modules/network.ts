/**
 * unmask-network — the "Sniffer".
 *
 * Captures all JSON-ish responses via the Chrome DevTools Protocol so the
 * agent can read prices, IDs, currencies, etc. directly from the wire instead
 * of parsing brittle HTML. URLs and bodies are tagged with heuristic keywords
 * (survey, reward, price, list, …) so the agent can quickly find what it
 * actually cares about.
 */
import type { CDPSession, Page } from 'playwright';
import type { NetworkCapture } from '../schemas/unmask.js';
import { logger } from '../utils/logger.js';

const DEFAULT_KEYWORDS = [
  'survey',
  'surveys',
  'reward',
  'rewards',
  'price',
  'prices',
  'currency',
  'list',
  'feed',
  'offer',
  'offers',
  'task',
  'tasks',
  'queue',
];

export interface NetworkSnifferOptions {
  /** Keywords matched against URL + parsed JSON keys / values. */
  keywords?: string[];
  /** Hard cap on captured responses to avoid memory blow-ups. */
  max?: number;
  /** Maximum body bytes parsed per response. Larger bodies are skipped. */
  maxBodyBytes?: number;
  /** Only keep matches when at least one keyword hit. Default: false. */
  onlyMatched?: boolean;
}

export class NetworkSniffer {
  private readonly captures: NetworkCapture[] = [];
  private cdp: CDPSession | null = null;
  private readonly opts: Required<NetworkSnifferOptions>;
  private readonly pendingRequests = new Map<
    string,
    { url: string; method: string; timestamp: string }
  >();

  constructor(opts: NetworkSnifferOptions = {}) {
    this.opts = {
      keywords: opts.keywords ?? DEFAULT_KEYWORDS,
      max: opts.max ?? 500,
      maxBodyBytes: opts.maxBodyBytes ?? 256 * 1024,
      onlyMatched: opts.onlyMatched ?? false,
    };
  }

  async attach(page: Page): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    this.cdp = cdp;
    await cdp.send('Network.enable');

    cdp.on('Network.requestWillBeSent', (event) => {
      this.pendingRequests.set(event.requestId, {
        url: event.request.url,
        method: event.request.method,
        timestamp: new Date().toISOString(),
      });
    });

    cdp.on('Network.responseReceived', async (event) => {
      if (this.captures.length >= this.opts.max) return;

      const meta = this.pendingRequests.get(event.requestId);
      const url = event.response.url;
      const contentType = (event.response.headers['content-type'] ||
        event.response.headers['Content-Type'] ||
        '') as string;

      const isJsonLike =
        contentType.includes('application/json') ||
        contentType.includes('+json') ||
        contentType.includes('text/json');

      const matched = this.matchKeywords(url);
      if (!isJsonLike && matched.length === 0) return;
      if (this.opts.onlyMatched && matched.length === 0 && !isJsonLike) return;

      const capture: NetworkCapture = {
        requestId: event.requestId,
        url,
        method: meta?.method ?? 'GET',
        status: event.response.status,
        contentType: contentType || undefined,
        matched,
        timestamp: meta?.timestamp ?? new Date().toISOString(),
      };

      if (isJsonLike) {
        try {
          const body = await cdp.send('Network.getResponseBody', { requestId: event.requestId });
          const raw = body.base64Encoded
            ? Buffer.from(body.body, 'base64').toString('utf8')
            : body.body;
          capture.bodyBytes = Buffer.byteLength(raw, 'utf8');
          if (capture.bodyBytes <= this.opts.maxBodyBytes) {
            try {
              capture.json = JSON.parse(raw);
              const bodyMatched = this.matchKeywords(raw);
              if (bodyMatched.length > 0) {
                capture.matched = Array.from(new Set([...capture.matched, ...bodyMatched]));
              }
            } catch {
              // Not actually JSON. Skip body but keep metadata.
            }
          }
        } catch (err) {
          logger.debug('network: getResponseBody failed', {
            requestId: event.requestId,
            err: (err as Error).message,
          });
        }
      }

      if (this.opts.onlyMatched && capture.matched.length === 0) return;
      this.captures.push(capture);
    });
  }

  async detach(): Promise<void> {
    if (this.cdp) {
      try {
        await this.cdp.detach();
      } catch {
        /* ignore */
      }
      this.cdp = null;
    }
  }

  results(): NetworkCapture[] {
    return [...this.captures];
  }

  /** Filter captures that look most likely to contain item lists for the agent. */
  topCandidates(limit = 10): NetworkCapture[] {
    return [...this.captures]
      .filter((c) => c.matched.length > 0 || (c.contentType ?? '').includes('json'))
      .sort((a, b) => b.matched.length - a.matched.length)
      .slice(0, limit);
  }

  private matchKeywords(haystack: string): string[] {
    const lc = haystack.toLowerCase();
    const hits: string[] = [];
    for (const kw of this.opts.keywords) {
      if (lc.includes(kw)) hits.push(kw);
    }
    return hits;
  }
}
