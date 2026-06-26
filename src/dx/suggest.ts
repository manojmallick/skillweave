// "Did you mean?" — a small Levenshtein helper so a mistyped command or skill
// name guides the user instead of dead-ending.

/** Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/**
 * The candidate closest to `input`, or null when none is reasonably close.
 * The distance bound scales with input length (capped at `maxDistance`) so short
 * typos match tightly and longer ones a little more loosely.
 */
export function closest(
  input: string,
  candidates: readonly string[],
  maxDistance = 3,
): string | null {
  const bound = Math.min(maxDistance, Math.max(2, Math.floor(input.length / 2)));
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(input, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best !== null && bestDist <= bound ? best : null;
}
