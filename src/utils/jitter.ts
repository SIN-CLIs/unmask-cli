/**
 * Human-emulation timing helpers.
 *
 * Anti-bot systems track focus events, keystroke cadence and timing patterns.
 * We add a "Micro-Jitter" of 500-1000ms between rapid actions and a longer
 * "Human Pause" of 30-60s between successful surveys, per the SOTA pattern
 * in Issue #2.
 */
export interface JitterOptions {
  min: number;
  max: number;
}

export function randomInt(min: number, max: number): number {
  if (max < min) throw new Error(`randomInt: max (${max}) < min (${min})`);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function jitterMs(opts: JitterOptions): number {
  return randomInt(opts.min, opts.max);
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function microJitter(): Promise<number> {
  const ms = jitterMs({ min: 500, max: 1000 });
  await sleep(ms);
  return ms;
}

export async function humanPause(): Promise<number> {
  const ms = jitterMs({ min: 30_000, max: 60_000 });
  await sleep(ms);
  return ms;
}
