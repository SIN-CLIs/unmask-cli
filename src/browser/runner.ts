/**
 * Playwright runner with reasonable defaults for stealth-friendly automation.
 *
 * Note: this is the runner, not a stealth implementation. For full stealth
 * (canvas/WebGL fingerprinting, navigator patches, etc.) compose this with
 * `playstealth-cli` or apply the `applyStealthPatches` helper below.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export interface RunnerOptions {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  locale?: string;
  timezoneId?: string;
  storageStatePath?: string;
  /** Apply built-in stealth patches before any page script runs. */
  stealth?: boolean;
  /** Default per-page timeout in ms. */
  timeout?: number;
  /** Connect to an already-running browser via CDP instead of launching. */
  cdpEndpoint?: string;
}

/** Type alias for the dispatcher / IPC callers. */
export type RunBrowserOptions = RunnerOptions;

export interface RunnerHandle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export interface RunBrowserHandle {
  browser: Browser;
  context: BrowserContext;
  close: () => Promise<void>;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function launchBrowser(opts: RunnerOptions = {}): Promise<RunnerHandle> {
  const browser = await chromium.launch({
    headless: opts.headless ?? true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent: opts.userAgent ?? DEFAULT_UA,
    viewport: opts.viewport ?? { width: 1366, height: 768 },
    locale: opts.locale ?? 'de-DE',
    timezoneId: opts.timezoneId ?? 'Europe/Berlin',
    ...(opts.storageStatePath ? { storageState: opts.storageStatePath } : {}),
  });

  if (opts.stealth) {
    await applyStealthPatches(context);
  }

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Context-only variant used by the IPC dispatcher (where pages are created
 * lazily per RPC `open` call). Supports plain launch and CDP attach.
 */
export async function runBrowser(opts: RunnerOptions = {}): Promise<RunBrowserHandle> {
  let browser: Browser;
  if (opts.cdpEndpoint) {
    browser = await chromium.connectOverCDP(opts.cdpEndpoint);
  } else {
    browser = await chromium.launch({
      headless: opts.headless ?? true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }

  const existing = browser.contexts();
  const context: BrowserContext =
    existing[0] ??
    (await browser.newContext({
      userAgent: opts.userAgent ?? DEFAULT_UA,
      viewport: opts.viewport ?? { width: 1366, height: 768 },
      locale: opts.locale ?? 'de-DE',
      timezoneId: opts.timezoneId ?? 'Europe/Berlin',
      ...(opts.storageStatePath ? { storageState: opts.storageStatePath } : {}),
    }));

  if (opts.timeout) context.setDefaultTimeout(opts.timeout);

  if (opts.stealth) {
    await applyStealthPatches(context);
  }

  return {
    browser,
    context,
    close: async () => {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Minimal in-house stealth patches. Use `playstealth-cli` for full coverage.
 * These cover the most common bot detections: webdriver flag, navigator.plugins,
 * navigator.languages and the chrome runtime object.
 */
export async function applyStealthPatches(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // navigator.webdriver -> undefined
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => undefined,
      configurable: true,
    });

    // languages
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['de-DE', 'de', 'en-US', 'en'],
      configurable: true,
    });

    // plugins (non-empty array)
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
      configurable: true,
    });

    // chrome runtime
    const w = window as unknown as { chrome?: unknown };
    if (!w.chrome) {
      w.chrome = { runtime: {} };
    }

    // permissions.query
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);
  });
}
