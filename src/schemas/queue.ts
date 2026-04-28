/**
 * Persistent state schemas for the sequential queue worker (Issue #2).
 * The queue intentionally never runs items in parallel — sessions, focus
 * tracking and human-emulation strategies all depend on strict serialization.
 */
import { z } from 'zod';
import { SurveySchema } from './unmask.js';

export const QueueItemStatusSchema = z.enum([
  'pending',
  'in_progress',
  'success',
  'disqualified',
  'failed',
  'blacklisted',
]);
export type QueueItemStatus = z.infer<typeof QueueItemStatusSchema>;

export const QueueItemSchema = z.object({
  survey: SurveySchema,
  status: QueueItemStatusSchema.default('pending'),
  attempts: z.number().int().nonnegative().default(0),
  lastError: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});
export type QueueItem = z.infer<typeof QueueItemSchema>;

export const QueueStateSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Currently processing index (-1 = idle). */
  cursor: z.number().int().default(-1),
  items: z.array(QueueItemSchema).default([]),
  /** Permanent blacklist of survey IDs that should never be retried. */
  blacklist: z.array(z.string()).default([]),
  /** Aggregate counters for telemetry. */
  stats: z
    .object({
      processed: z.number().int().nonnegative().default(0),
      success: z.number().int().nonnegative().default(0),
      disqualified: z.number().int().nonnegative().default(0),
      failed: z.number().int().nonnegative().default(0),
    })
    .default({ processed: 0, success: 0, disqualified: 0, failed: 0 }),
});
export type QueueState = z.infer<typeof QueueStateSchema>;

export function emptyQueueState(): QueueState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    cursor: -1,
    items: [],
    blacklist: [],
    stats: { processed: 0, success: 0, disqualified: 0, failed: 0 },
  };
}
