import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Notifier } from '../src/utils/notify.js';

describe('Notifier', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does nothing when no targets configured', async () => {
    const n = new Notifier();
    await n.send({ level: 'info', title: 't', message: 'm' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fans out to all configured targets with matching payload shapes', async () => {
    const n = new Notifier({
      webhookUrl: 'https://example.com/wh',
      slackUrl: 'https://example.com/slack',
      discordUrl: 'https://example.com/discord',
    });
    await n.send({ level: 'success', title: 'done', message: '5/5 ok' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const slack = calls.find(([url]) => String(url).includes('/slack'))!;
    const discord = calls.find(([url]) => String(url).includes('/discord'))!;
    expect(JSON.parse((slack[1] as RequestInit).body as string).text).toContain('done');
    expect(JSON.parse((discord[1] as RequestInit).body as string).content).toContain('done');
  });
});
