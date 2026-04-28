import { describe, expect, it } from 'vitest';
import {
  SurveySchema,
  UnmaskResponseSchema,
  emptyUnmaskResponse,
  parseUnmaskResponse,
} from '../src/schemas/unmask.js';
import { QueueStateSchema, emptyQueueState } from '../src/schemas/queue.js';

describe('SurveySchema', () => {
  it('parses a minimal valid survey', () => {
    const survey = SurveySchema.parse({
      id: 's-1',
      reward: { amount: 0.5, currency: 'EUR' },
      confidence: 0.9,
      selector: '#s-1',
    });
    expect(survey.id).toBe('s-1');
    expect(survey.reward.currency).toBe('EUR');
    expect(survey.fallbackSelectors).toEqual([]);
    expect(survey.actionType).toBe('click');
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      SurveySchema.parse({
        id: 's-1',
        reward: { amount: 1 },
        confidence: 5,
        selector: '#x',
      }),
    ).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() =>
      SurveySchema.parse({
        id: 's-1',
        reward: { amount: -1 },
        confidence: 0.5,
        selector: '#x',
      }),
    ).toThrow();
  });
});

describe('UnmaskResponseSchema', () => {
  it('round-trips an empty response', () => {
    const empty = emptyUnmaskResponse('https://example.com/');
    const parsed = parseUnmaskResponse(empty);
    expect(parsed.tool).toBe('unmask-cli');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.url).toBe('https://example.com/');
  });

  it('rejects mismatching schemaVersion', () => {
    const bad = { ...emptyUnmaskResponse('https://example.com/'), schemaVersion: 2 };
    expect(() => UnmaskResponseSchema.parse(bad)).toThrow();
  });

  it('requires absolute URL', () => {
    const bad = { ...emptyUnmaskResponse('https://example.com/'), url: '/relative' };
    expect(() => UnmaskResponseSchema.parse(bad)).toThrow();
  });
});

describe('QueueStateSchema', () => {
  it('starts empty and serializable', () => {
    const s = emptyQueueState();
    expect(s.cursor).toBe(-1);
    expect(s.items).toEqual([]);
    expect(s.blacklist).toEqual([]);
    const round = QueueStateSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(round.stats.processed).toBe(0);
  });
});
