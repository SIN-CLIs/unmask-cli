/**
 * unmask-console — the "Mind Reader".
 *
 * Hooks into every page in the BrowserContext and captures console messages
 * with heuristic tags (loop, error, load, network, auth) so the agent can
 * reason about lifecycle phases without inspecting the DOM.
 */
import type { ConsoleMessage, Page } from 'playwright';
import type { ConsoleEntry } from '../schemas/unmask.js';

const DEFAULT_TAG_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: 'loop', pattern: /\bloop\b|\bparse\w*\b/i },
  { tag: 'error', pattern: /\berror\b|\bfailed\b|\bexception\b/i },
  { tag: 'load', pattern: /\bload\b|\bready\b|\binit\b/i },
  { tag: 'network', pattern: /\bxhr\b|\bfetch\b|\brequest\b|\bresponse\b/i },
  { tag: 'auth', pattern: /\blogin\b|\btoken\b|\bsession\b|\bauth\b/i },
  { tag: 'survey', pattern: /\bsurvey\b|\breward\b|\boffer\b/i },
];

export interface ConsoleListenerOptions {
  max?: number;
  tagRules?: Array<{ tag: string; pattern: RegExp }>;
}

export class ConsoleListener {
  private readonly entries: ConsoleEntry[] = [];
  private readonly opts: Required<ConsoleListenerOptions>;

  constructor(opts: ConsoleListenerOptions = {}) {
    this.opts = {
      max: opts.max ?? 1_000,
      tagRules: opts.tagRules ?? DEFAULT_TAG_RULES,
    };
  }

  attach(page: Page): void {
    page.on('console', (msg) => this.handle(msg));
    page.on('pageerror', (err) => {
      this.push({
        level: 'error',
        text: `pageerror: ${err.message}`,
        tags: ['error'],
        url: page.url(),
        timestamp: new Date().toISOString(),
      });
    });
  }

  private handle(msg: ConsoleMessage): void {
    if (this.entries.length >= this.opts.max) return;
    const level = mapLevel(msg.type());
    const text = msg.text();
    const tags = this.tag(text);
    this.push({
      level,
      text,
      tags,
      url: msg.location().url || undefined,
      timestamp: new Date().toISOString(),
    });
  }

  private push(entry: ConsoleEntry): void {
    this.entries.push(entry);
  }

  private tag(text: string): string[] {
    const hits = new Set<string>();
    for (const rule of this.opts.tagRules) {
      if (rule.pattern.test(text)) hits.add(rule.tag);
    }
    return [...hits];
  }

  results(): ConsoleEntry[] {
    return [...this.entries];
  }
}

function mapLevel(type: string): ConsoleEntry['level'] {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    case 'trace':
      return 'trace';
    default:
      return 'log';
  }
}
