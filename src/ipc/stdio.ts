import readline from 'node:readline';
import { Dispatcher, RpcRequestSchema } from './dispatch.js';
import { logger } from '../utils/logger.js';

/**
 * Runs the dispatcher as a JSON-RPC 2.0 server speaking newline-delimited
 * JSON over stdin/stdout. This is what `playstealth-cli` (Python) spawns
 * and pipes through:
 *
 *     proc = subprocess.Popen(["unmask", "serve", "--stdio"],
 *                              stdin=PIPE, stdout=PIPE, text=True)
 *     proc.stdin.write(json.dumps({...}) + "\n")
 */
export async function runStdioServer(): Promise<void> {
  const dispatcher = new Dispatcher();
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  const exit = async (code = 0) => {
    try {
      await dispatcher.closeAll();
    } finally {
      process.exit(code);
    }
  };
  process.on('SIGINT', () => void exit(0));
  process.on('SIGTERM', () => void exit(0));

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    void (async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error: ' + (err as Error).message },
          }) + '\n',
        );
        return;
      }
      const reqRes = RpcRequestSchema.safeParse(parsed);
      if (!reqRes.success) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32600, message: 'Invalid Request', data: reqRes.error.flatten() },
          }) + '\n',
        );
        return;
      }
      const response = await dispatcher.dispatch(reqRes.data);
      process.stdout.write(JSON.stringify(response) + '\n');
    })();
  });

  rl.on('close', () => void exit(0));
  logger.info('unmask-cli stdio server ready (JSON-RPC 2.0)');
}
