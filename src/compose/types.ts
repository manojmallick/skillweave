// COMPOSE primitive (v2.0.0) — composition pattern types.

/** A unit of composed work: input in, (async) output out. */
export type Step<I, O> = (input: I) => Promise<O> | O;

/** Result of a `loop` — the final value and how many iterations ran. */
export interface LoopResult<T> {
  value: T;
  iterations: number;
}

/** A node in a dependency graph (for `dagLayers`). */
export interface DagNode {
  id: string;
  depends_on?: string[];
}
