import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { observe, ObserveCandidateSchema, type ObserveOptions } from '../src/llm/observe.js';
import { extract, type ExtractOptions } from '../src/llm/extract.js';
import { act, ActPlanSchema, type ActOptions } from '../src/llm/act.js';

describe('observe', () => {
  it('ObserveCandidateSchema validates correctly', () => {
    const valid = {
      rank: 0,
      selector: 'button#next',
      reason: 'primary CTA button',
      confidence: 0.95,
    };
    const result = ObserveCandidateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('ObserveCandidateSchema rejects out-of-range confidence', () => {
    const invalid = {
      rank: 0,
      selector: 'button',
      reason: 'x',
      confidence: 1.5,
    };
    const result = ObserveCandidateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('ObserveCandidateSchema allows optional role and label', () => {
    const withOptional = {
      rank: 1,
      selector: 'input[type=text]',
      fallbackSelectors: ['#email', '[name=email]'],
      reason: 'email field',
      confidence: 0.8,
      role: 'input',
      label: 'Email Address',
    };
    const result = ObserveCandidateSchema.safeParse(withOptional);
    expect(result.success).toBe(true);
  });
});

describe('act', () => {
  it('ActPlanSchema validates click', () => {
    const result = ActPlanSchema.safeParse({ verb: 'click', target: 'next button' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verb).toBe('click');
    }
  });

  it('ActPlanSchema validates type with value', () => {
    const result = ActPlanSchema.safeParse({ verb: 'type', target: 'email input', value: 'test@example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('test@example.com');
    }
  });

  it('ActPlanSchema validates all verbs', () => {
    const verbs = ['click', 'type', 'select', 'press', 'hover', 'scroll'] as const;
    for (const verb of verbs) {
      const result = ActPlanSchema.safeParse({ verb, target: 'test' });
      expect(result.success).toBe(true);
    }
  });

  it('ActPlanSchema rejects unknown verb', () => {
    const result = ActPlanSchema.safeParse({ verb: 'drag', target: 'test' });
    expect(result.success).toBe(false);
  });

  it('ActPlanSchema allows free-text intent (target only)', () => {
    const result = ActPlanSchema.safeParse({ verb: 'click', target: 'click the Continue button' });
    expect(result.success).toBe(true);
  });

  it('ActPlanSchema allows optional reason', () => {
    const result = ActPlanSchema.safeParse({ verb: 'click', target: 'btn', reason: 'primary action' });
    expect(result.success).toBe(true);
  });
});