import { z, type ZodTypeAny } from 'zod';
import type { Page } from 'playwright';
import { runBrowser, type RunBrowserOptions } from '../browser/runner.js';
import { observe } from '../llm/observe.js';
import { extract } from '../llm/extract.js';
import { act } from '../llm/act.js';
import { DomScanner } from '../modules/dom.js';
import { NetworkSniffer } from '../modules/network.js';
import { ConsoleListener } from '../modules/console.js';
import { Session } from '../session/session.js';
import { bundleSession } from '../replay/bundle.js';
import { logger } from '../utils/logger.js';
import { preScan } from '../commands/pre-scan.js';
import { MacOSAXBridge } from '../detectors/macos-ax-bridge.js';

export const RpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
});
export type RpcRequest = z.infer<typeof RpcRequestSchema>;

export interface RpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}
export interface RpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}
export type RpcResponse = RpcSuccess | RpcError;

interface PageHandle {
  id: string;
  page: Page;
  cleanup: () => Promise<void>;
  session: Session;
  sniffer: NetworkSniffer | null;
  console: ConsoleListener | null;
}

/**
 * Long-lived dispatcher that owns one or more open Playwright pages.
 * Methods map 1:1 to the public unmask-cli API and are language-agnostic
 * via JSON-RPC 2.0 — the Python `playstealth-cli` runner consumes this.
 */
export class Dispatcher {
  private readonly pages = new Map<string, PageHandle>();
  private nextHandleId = 1;

  async dispatch(req: RpcRequest): Promise<RpcResponse> {
    const id: string | number | null = req.id ?? null;
    try {
      const result = await this.invoke(req.method, req.params);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      const e = err as Error;
      logger.error('dispatch error', { method: req.method, err: e.message });
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: e.message },
      };
    }
  }

  /** Public method registry. Add new RPC methods here. */
  private async invoke(method: string, rawParams: unknown): Promise<unknown> {
    switch (method) {
      case 'pre-scan': {
        const params = parse(z.object({ url: z.string().url() }), rawParams);
        const h = await this.openPage(params);
        return preScan(h.page.context().browser()!, params.url);
      }
      case 'open': {
        const params = parse(
          z.object({
            url: z.string().url(),
            headless: z.boolean().optional(),
            userAgent: z.string().optional(),
            viewport: z.object({ width: z.number(), height: z.number() }).optional(),
            timeout: z.number().int().positive().optional(),
            sessionLabel: z.string().optional(),
            cdpEndpoint: z.string().optional(),
          }),
          rawParams,
        );
        const handle = await this.openPage(params);
        return { handleId: handle.id, sessionId: handle.session.id, sessionDir: handle.session.dir };
      }
      case 'close': {
        const params = parse(z.object({ handleId: z.string() }), rawParams);
        const h = this.requireHandle(params.handleId);
        await h.session.end();
        await h.cleanup();
        this.pages.delete(params.handleId);
        return { ok: true, sessionId: h.session.id, sessionDir: h.session.dir };
      }
      case 'navigate': {
        const params = parse(z.object({ handleId: z.string(), url: z.string().url() }), rawParams);
        const h = this.requireHandle(params.handleId);
        await h.page.goto(params.url, { waitUntil: 'domcontentloaded' });
        await h.session.append({
          ts: Date.now(),
          kind: 'navigate',
          data: { url: params.url },
        });
        return { url: h.page.url() };
      }
      case 'observe': {
        const params = parse(
          z.object({
            handleId: z.string(),
            intent: z.string(),
            topK: z.number().int().positive().optional(),
            vision: z.boolean().optional(),
          }),
          rawParams,
        );
        const h = this.requireHandle(params.handleId);
        const observeOpts: Parameters<typeof observe>[2] = {};
        if (params.topK !== undefined) observeOpts.topK = params.topK;
        if (params.vision !== undefined) observeOpts.vision = params.vision;
        const result = await observe(h.page, params.intent, observeOpts);
        await h.session.append({ ts: Date.now(), kind: 'observe', data: { intent: params.intent, result } });
        return result;
      }
      case 'act': {
        const params = parse(
          z.object({
            handleId: z.string(),
            intent: z.string(),
            verb: z.string().optional(),
            value: z.string().optional(),
            vision: z.boolean().optional(),
            dryRun: z.boolean().optional(),
          }),
          rawParams,
        );
        const h = this.requireHandle(params.handleId);
        const intent = params.verb
          ? { verb: params.verb as 'click', target: params.intent, ...(params.value !== undefined ? { value: params.value } : {}) }
          : params.intent;
        const actOpts: Parameters<typeof act>[2] = {};
        if (params.vision !== undefined) actOpts.vision = params.vision;
        if (params.dryRun !== undefined) actOpts.dryRun = params.dryRun;
        const result = await act(h.page, intent, actOpts);
        await h.session.append({ ts: Date.now(), kind: 'act', data: { intent, result } });
        return result;
      }
      case 'extract': {
        const params = parse(
          z.object({
            handleId: z.string(),
            schema: z.unknown(),
            instruction: z.string().optional(),
            vision: z.boolean().optional(),
          }),
          rawParams,
        );
        const h = this.requireHandle(params.handleId);
        // For RPC the schema is sent as-is; we wrap it in a passthrough Zod object
        // and rely on the LLM to obey the JSON shape.
        const passthrough = z.unknown();
        const extractOpts: Parameters<typeof extract>[2] = {};
        if (params.instruction !== undefined) extractOpts.instruction = params.instruction;
        if (params.vision !== undefined) extractOpts.vision = params.vision;
        const data = await extract(h.page, passthrough, extractOpts);
        await h.session.append({ ts: Date.now(), kind: 'extract', data: { result: data } });
        return data;
      }
      case 'scanDom': {
        const params = parse(
          z.object({
            handleId: z.string(),
            max: z.number().int().positive().optional(),
            minConfidence: z.number().min(0).max(1).optional(),
          }),
          rawParams,
        );
        const h = this.requireHandle(params.handleId);
        const scanner = new DomScanner({
          ...(params.max !== undefined ? { max: params.max } : {}),
          ...(params.minConfidence !== undefined ? { minConfidence: params.minConfidence } : {}),
        });
        return scanner.scan(h.page);
      }
      case 'screenshot': {
        const params = parse(
          z.object({ handleId: z.string(), fullPage: z.boolean().optional() }),
          rawParams,
        );
        const h = this.requireHandle(params.handleId);
        const path = h.session.nextScreenshotPath();
        await h.page.screenshot({ path, fullPage: params.fullPage ?? false });
        await h.session.append({ ts: Date.now(), kind: 'screenshot', data: { path } });
        return { path };
      }
      case 'bundle': {
        const params = parse(z.object({ handleId: z.string() }), rawParams);
        const h = this.requireHandle(params.handleId);
        const bundle = await bundleSession(h.session.dir);
        return { bundle };
      }
      case 'session': {
        const params = parse(z.object({ handleId: z.string() }), rawParams);
        const h = this.requireHandle(params.handleId);
        return { sessionId: h.session.id, sessionDir: h.session.dir };
      }
      case 'list': {
        return [...this.pages.values()].map((h) => ({
          handleId: h.id,
          url: h.page.url(),
          sessionId: h.session.id,
        }));
      }
      case 'ping':
        return { pong: true, ts: Date.now() };
      case 'shutdown': {
        await this.closeAll();
        return { ok: true };
      }
      case 'ax.windows.list': {
        const params = parse(
          z.object({
            pid: z.number().int().optional(),
            bundleId: z.string().optional(),
            isSheet: z.boolean().optional(),
            isDialog: z.boolean().optional(),
            titleContains: z.string().optional(),
          }).optional(),
          rawParams,
        );
        const bridge = new MacOSAXBridge();
        let windows = bridge.listWindows();
        if (params?.pid) windows = windows.filter(w => w.pid === params.pid);
        if (params?.bundleId) windows = windows.filter(w => w.bundle_id === params.bundleId);
        if (params?.isSheet !== undefined) windows = windows.filter(w => w.is_sheet === params.isSheet);
        if (params?.isDialog !== undefined) windows = windows.filter(w => w.is_dialog === params.isDialog);
        if (params?.titleContains) {
          const title = params.titleContains.toLowerCase();
          windows = windows.filter(w => w.window_title.toLowerCase().includes(title));
        }
        return { windows, count: windows.length };
      }
      case 'ax.elements.get': {
        const params = parse(
          z.object({
            pid: z.number().int(),
            windowTitle: z.string().optional(),
            depth: z.number().int().optional().default(10),
          }),
          rawParams,
        );
        const bridge = new MacOSAXBridge();
        const elements = bridge.getElements(params.pid, params.windowTitle, params.depth);
        return { elements, count: elements.length };
      }
      case 'ax.find.text': {
        const params = parse(
          z.object({
            query: z.string(),
          }),
          rawParams,
        );
        const bridge = new MacOSAXBridge();
        const results = bridge.findText(params.query);
        return { matches: results, count: results.length };
      }
      case 'ax.click': {
        const params = parse(
          z.object({
            pid: z.number().int(),
            elementIndex: z.number().int(),
          }),
          rawParams,
        );
        const bridge = new MacOSAXBridge();
        return bridge.clickElement(params.pid, params.elementIndex);
      }
      case 'ax.set_value': {
        const params = parse(
          z.object({
            pid: z.number().int(),
            elementIndex: z.number().int(),
            value: z.string(),
          }),
          rawParams,
        );
        const bridge = new MacOSAXBridge();
        return bridge.setValue(params.pid, params.elementIndex, params.value);
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async openPage(params: {
    url: string;
    headless?: boolean;
    userAgent?: string;
    viewport?: { width: number; height: number };
    timeout?: number;
    sessionLabel?: string;
    cdpEndpoint?: string;
  }): Promise<PageHandle> {
    const session = new Session(params.sessionLabel ? { label: params.sessionLabel } : {});
    await session.init({ openedFor: params.url, label: params.sessionLabel });
    const runOpts: RunBrowserOptions = {};
    if (params.headless !== undefined) runOpts.headless = params.headless;
    if (params.userAgent !== undefined) runOpts.userAgent = params.userAgent;
    if (params.viewport !== undefined) runOpts.viewport = params.viewport;
    if (params.timeout !== undefined) runOpts.timeout = params.timeout;
    if (params.cdpEndpoint !== undefined) runOpts.cdpEndpoint = params.cdpEndpoint;
    const ctx = await runBrowser(runOpts);
    const page = await ctx.context.newPage();
    const sniffer = new NetworkSniffer();
    await sniffer.attach(page);
    const consoleListener = new ConsoleListener();
    consoleListener.attach(page);
    await page.goto(params.url, { waitUntil: 'domcontentloaded' });
    const id = `h${this.nextHandleId++}`;
    const handle: PageHandle = {
      id,
      page,
      session,
      sniffer,
      console: consoleListener,
      cleanup: async () => {
        try {
          await sniffer.detach();
        } catch {}
        try {
          await page.close();
        } catch {}
        await ctx.close();
      },
    };
    this.pages.set(id, handle);
    return handle;
  }

  async closeAll(): Promise<void> {
    for (const h of this.pages.values()) {
      try {
        await h.session.end();
      } catch {}
      try {
        await h.cleanup();
      } catch {}
    }
    this.pages.clear();
  }

  private requireHandle(id: string): PageHandle {
    const h = this.pages.get(id);
    if (!h) throw new Error(`Unknown handleId: ${id}`);
    return h;
  }
}

function parse<S extends ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  return schema.parse(raw ?? {}) as z.infer<S>;
}
