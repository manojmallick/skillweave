// OBSERVE — A/B skill testing. Compare two skill versions by their judge score.

export interface ABResult {
  winner: "a" | "b" | "tie";
  a: number;
  b: number;
  /** scoreA − scoreB. */
  delta: number;
}

/** Compare two judge scores; the higher wins (equal is a tie). */
export function abTest(scoreA: number, scoreB: number): ABResult {
  const delta = Number((scoreA - scoreB).toFixed(6));
  const winner = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "tie";
  return { winner, a: scoreA, b: scoreB, delta };
}
