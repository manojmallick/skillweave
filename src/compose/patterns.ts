// Composition patterns — pure async combinators over skill-step functions.
// SigMap covered sequential / parallel / map; SkillWeave completes the set with
// reduce / conditional / loop, plus DAG-layer resolution.

import type { DagNode, LoopResult, Step } from "./types.js";

/** Thread `input` through `steps` in order, each receiving the previous output. */
export async function sequential<T>(input: T, steps: Step<T, T>[]): Promise<T> {
  let acc = input;
  for (const step of steps) acc = await step(acc);
  return acc;
}

/** Run every branch on the same `input` concurrently and await all results. */
export async function parallel<I, O>(input: I, branches: Step<I, O>[]): Promise<O[]> {
  return Promise.all(branches.map((b) => Promise.resolve(b(input))));
}

/** Apply `fn` to each item concurrently. */
export async function mapPattern<I, O>(items: I[], fn: Step<I, O>): Promise<O[]> {
  return Promise.all(items.map((i) => Promise.resolve(fn(i))));
}

/** Fold `items` into a single accumulator, left to right. */
export async function reducePattern<I, A>(
  items: I[],
  fn: (acc: A, item: I) => Promise<A> | A,
  init: A,
): Promise<A> {
  let acc = init;
  for (const item of items) acc = await fn(acc, item);
  return acc;
}

/** Run `thenStep` when `when(input)` holds, else `elseStep` (or return undefined). */
export async function conditional<I, O>(
  input: I,
  when: (input: I) => boolean | Promise<boolean>,
  thenStep: Step<I, O>,
  elseStep?: Step<I, O>,
): Promise<O | undefined> {
  if (await when(input)) return thenStep(input);
  return elseStep ? elseStep(input) : undefined;
}

/** Repeat `body` until `until(value, iteration)` holds or `maxIterations` is hit. */
export async function loop<T>(
  input: T,
  body: Step<T, T>,
  until: (value: T, iteration: number) => boolean | Promise<boolean>,
  maxIterations = 10,
): Promise<LoopResult<T>> {
  let value = input;
  let iterations = 0;
  while (iterations < maxIterations) {
    value = await body(value);
    iterations++;
    if (await until(value, iterations)) break;
  }
  return { value, iterations };
}

/**
 * DAG resolution — order `nodes` into layers where every node's dependencies sit
 * in an earlier layer, so a layer's nodes can run in parallel. Throws on an
 * unknown dependency or a cycle.
 */
export function dagLayers(nodes: DagNode[]): string[][] {
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    for (const d of n.depends_on ?? []) {
      if (!ids.has(d)) throw new Error(`dagLayers: "${n.id}" depends on unknown node "${d}"`);
    }
  }

  const done = new Set<string>();
  const layers: string[][] = [];
  let remaining = [...nodes];

  while (remaining.length) {
    const layer = remaining.filter((n) => (n.depends_on ?? []).every((d) => done.has(d)));
    if (layer.length === 0) {
      throw new Error(`dagLayers: cycle among [${remaining.map((n) => n.id).join(", ")}]`);
    }
    layer.forEach((n) => done.add(n.id));
    layers.push(layer.map((n) => n.id));
    remaining = remaining.filter((n) => !done.has(n.id));
  }
  return layers;
}
