// Memory decay — records older than a staleness threshold no longer inform
// adaptation. Pure: the reference time is always passed in.

/** Default staleness threshold: 30 days. */
export const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** True when `ts` is older than `maxAgeMs` relative to `now` (or unparseable). */
export function isStale(ts: string, now: Date, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > maxAgeMs;
}
