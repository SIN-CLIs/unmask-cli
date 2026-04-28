import { describe, it, expect } from 'vitest';
import { Dispatcher, RpcRequestSchema } from '../src/ipc/dispatch.js';

describe('JSON-RPC Dispatcher', () => {
  it('validates RPC request shape', () => {
    expect(RpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'ping' }).success).toBe(true);
    expect(RpcRequestSchema.safeParse({ method: 'ping' }).success).toBe(false);
    expect(RpcRequestSchema.safeParse({ jsonrpc: '1.0', method: 'ping' }).success).toBe(false);
  });

  it('responds to ping without opening a browser', async () => {
    const d = new Dispatcher();
    const res = await d.dispatch({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect('result' in res).toBe(true);
    expect((res as { result: { pong: boolean } }).result.pong).toBe(true);
  });

  it('returns -32000 error envelope for unknown methods', async () => {
    const d = new Dispatcher();
    const res = await d.dispatch({ jsonrpc: '2.0', id: 7, method: 'totally.unknown' });
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.code).toBe(-32000);
      expect(res.error.message).toMatch(/Unknown method/);
      expect(res.id).toBe(7);
    }
  });

  it('returns error when handle id is unknown', async () => {
    const d = new Dispatcher();
    const res = await d.dispatch({
      jsonrpc: '2.0',
      id: 'a',
      method: 'observe',
      params: { handleId: 'nope', intent: 'x' },
    });
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.message).toMatch(/Unknown handleId/);
    }
  });
});
