import { describe, it, expect, vi } from 'vitest';
import { createPlaywrightSurveyRunner } from '../src/queue/playwright-runner.js';

const survey = (id: string, selector = '#cta') => ({
  id,
  reward: { amount: 1, currency: 'EUR' },
  confidence: 0.9,
  selector,
  fallbackSelectors: [],
  actionType: 'click' as const,
});

describe('createPlaywrightSurveyRunner', () => {
  it('reports recoveredSelector when self-heal matches a fallback', async () => {
    const click = vi.fn(async () => {});
    const locator = {
      click,
      waitFor: async () => {},
      getAttribute: async () => null,
      hover: async () => {},
      fill: async () => {},
      selectOption: async () => {},
      press: async () => {},
      scrollIntoViewIfNeeded: async () => {},
    };
    const page = {
      locator: vi
        .fn()
        // primary fails
        .mockReturnValueOnce({ first: () => ({ ...locator, waitFor: async () => { throw new Error('no'); } }) })
        // fallback resolves
        .mockReturnValue({ first: () => locator }),
      goto: async () => {},
      url: () => 'https://example.com/done',
      evaluate: async () => 'thank you for completing the survey',
      waitForLoadState: async () => {},
      close: async () => {},
      getByRole: () => ({ first: () => locator }),
      getByText: () => ({ first: () => locator }),
      screenshot: async () => {},
    };
    const ctx = { newPage: async () => page } as unknown as Parameters<typeof createPlaywrightSurveyRunner>[0];
    const runner = createPlaywrightSurveyRunner(ctx, { reusePage: true });
    const survey1 = { ...survey('s1'), fallbackSelectors: ['#fallback'] };
    const result = await runner(survey1, {});
    expect(result.outcome).toBe('success');
    expect(result.recoveredSelector).toBe('#fallback');
    expect(click).toHaveBeenCalled();
  });
});
