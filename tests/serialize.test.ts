import { describe, it, expect, vi } from 'vitest';
import { serializeForLLM } from '../src/llm/serialize.js';

const fakePage = (candidates: unknown[], url = 'https://example.com', title = 'Example') => ({
  url: vi.fn(() => url),
  title: vi.fn(async () => title),
  evaluate: vi.fn(async () => candidates),
});

describe('serializeForLLM', () => {
  it('produces compact line-numbered output bound to indexes', async () => {
    const cands = [
      {
        selector: '#a',
        fallbackSelectors: [],
        role: 'button',
        ariaLabel: 'Start',
        text: 'Start',
        visible: true,
        reasons: ['role'],
        confidence: 0.9,
      },
      {
        selector: '#b',
        fallbackSelectors: [],
        role: 'link',
        ariaLabel: undefined,
        text: 'Read more',
        visible: true,
        reasons: ['text'],
        confidence: 0.7,
      },
    ];
    const tree = await serializeForLLM(fakePage(cands) as never);
    expect(tree.url).toBe('https://example.com');
    expect(tree.title).toBe('Example');
    expect(tree.text).toContain('[0]');
    expect(tree.text).toContain('[1]');
    expect(tree.text).toContain('Start');
    expect(tree.index.size).toBe(2);
    expect(tree.index.get(0)?.selector).toBe('#a');
  });
});
