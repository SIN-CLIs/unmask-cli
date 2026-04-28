import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Dispatcher, RpcRequestSchema } from './dispatch.js';
import { logger } from '../utils/logger.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  /** Optional shared secret. Required as `Authorization: Bearer <token>` header. */
  authToken?: string;
}

/**
 * HTTP + WebSocket JSON-RPC server. Useful for cross-host integrations or
 * for inspecting from a browser.
 *
 *     POST /rpc           body: JSON-RPC request          → JSON-RPC response
 *     WS   /              one JSON-RPC frame per message  → response per frame
 *     GET  /healthz       → "ok"
 */
export async function runHttpServer(opts: HttpServerOptions = {}): Promise<void> {
  const port = opts.port ?? 8765;
  const host = opts.host ?? '127.0.0.1';
  const dispatcher = new Dispatcher();

  const checkAuth = (req: IncomingMessage): boolean => {
    if (!opts.authToken) return true;
    const header = req.headers['authorization'];
    return header === `Bearer ${opts.authToken}`;
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/rpc' && req.method === 'POST') {
      if (!checkAuth(req)) {
        res.writeHead(401);
        res.end();
        return;
      }
      let buf = '';
      req.on('data', (c: Buffer) => (buf += c.toString('utf8')));
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(buf || '{}');
          const reqRes = RpcRequestSchema.safeParse(parsed);
          if (!reqRes.success) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32600, message: 'Invalid Request' },
              }),
            );
            return;
          }
          const response = await dispatcher.dispatch(reqRes.data);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!checkAuth(req)) {
      ws.close(1008, 'unauthorized');
      return;
    }
    ws.on('message', (raw: Buffer) => {
      void (async () => {
        try {
          const parsed = JSON.parse(raw.toString('utf8'));
          const reqRes = RpcRequestSchema.safeParse(parsed);
          if (!reqRes.success) {
            ws.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32600, message: 'Invalid Request' },
              }),
            );
            return;
          }
          const response = await dispatcher.dispatch(reqRes.data);
          ws.send(JSON.stringify(response));
        } catch (err) {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: (err as Error).message },
            }),
          );
        }
      })();
    });
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  logger.info('unmask-cli HTTP+WS server listening', { url: `http://${host}:${port}` });

  const shutdown = async () => {
    await dispatcher.closeAll();
    await new Promise<void>((res) => server.close(() => res()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
