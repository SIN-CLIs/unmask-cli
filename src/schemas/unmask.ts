/**
 * SOTA "Schema-first JSON" output contract for unmask-cli.
 *
 * Every command emits JSON validated against these Zod schemas so downstream
 * agents (LLMs, workers, queue runners) receive deterministic, typed data.
 */
import { z } from 'zod';

// ---------- Reward / Money ----------

export const RewardSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1).default('EUR'),
});
export type Reward = z.infer<typeof RewardSchema>;

// ---------- Survey / Item ----------

export const SurveySchema = z.object({
  id: z.string().min(1),
  reward: RewardSchema,
  durationMinutes: z.number().int().nonnegative().optional(),
  /** 0..1 confidence the agent has that this item is real and clickable. */
  confidence: z.number().min(0).max(1),
  /** Primary CSS / ARIA selector used to act on the item. */
  selector: z.string().min(1),
  /** Alternate selectors discovered for self-healing. */
  fallbackSelectors: z.array(z.string()).default([]),
  /** Type of action expected to start the item. */
  actionType: z.enum(['click', 'js_click', 'navigate', 'form']).default('click'),
  /** ARIA / semantic info captured at discovery time. */
  semantic: z
    .object({
      role: z.string().optional(),
      ariaLabel: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Survey = z.infer<typeof SurveySchema>;

// ---------- Network capture (from CDP / Sniffer) ----------

export const NetworkCaptureSchema = z.object({
  requestId: z.string(),
  url: z.string().url(),
  method: z.string(),
  status: z.number().int().optional(),
  contentType: z.string().optional(),
  /** Heuristically tagged keywords that matched in the URL or body. */
  matched: z.array(z.string()).default([]),
  /** Parsed JSON body when the response is application/json (truncated to safe size). */
  json: z.unknown().optional(),
  /** Size of the body in bytes, even if not stored. */
  bodyBytes: z.number().int().nonnegative().optional(),
  timestamp: z.string().datetime(),
});
export type NetworkCapture = z.infer<typeof NetworkCaptureSchema>;

// ---------- DOM (semantic scanner) ----------

export const DomCandidateSchema = z.object({
  selector: z.string(),
  fallbackSelectors: z.array(z.string()).default([]),
  role: z.string().optional(),
  ariaLabel: z.string().optional(),
  text: z.string().optional(),
  /** True when the element is rendered, on-screen and interactable. */
  visible: z.boolean(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  reasons: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});
export type DomCandidate = z.infer<typeof DomCandidateSchema>;

// ---------- Console (browser console listener) ----------

export const ConsoleEntrySchema = z.object({
  level: z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']),
  text: z.string(),
  /** First matched tag (e.g. "loop", "error", "load") if heuristics flagged it. */
  tags: z.array(z.string()).default([]),
  url: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type ConsoleEntry = z.infer<typeof ConsoleEntrySchema>;

// ---------- Top-level "Unmask" response ----------

export const UnmaskResponseSchema = z.object({
  schemaVersion: z.literal(1),
  tool: z.literal('unmask-cli'),
  timestamp: z.string().datetime(),
  url: z.string().url(),
  status: z.enum(['success', 'partial', 'error']),
  durationMs: z.number().int().nonnegative(),
  surveys: z.array(SurveySchema).default([]),
  network: z.array(NetworkCaptureSchema).default([]),
  dom: z.array(DomCandidateSchema).default([]),
  console: z.array(ConsoleEntrySchema).default([]),
  errors: z.array(z.string()).default([]),
  meta: z.record(z.unknown()).optional(),
});
export type UnmaskResponse = z.infer<typeof UnmaskResponseSchema>;

// ---------- Helpers ----------

export function emptyUnmaskResponse(url: string): UnmaskResponse {
  return {
    schemaVersion: 1,
    tool: 'unmask-cli',
    timestamp: new Date().toISOString(),
    url,
    status: 'success',
    durationMs: 0,
    surveys: [],
    network: [],
    dom: [],
    console: [],
    errors: [],
  };
}

/**
 * Parse with strict validation. Throws a ZodError on schema violation, exactly
 * what an agent wants to surface a contract bug.
 */
export function parseUnmaskResponse(input: unknown): UnmaskResponse {
  return UnmaskResponseSchema.parse(input);
}
