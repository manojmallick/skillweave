---
title: Compose
description: SkillWeave's COMPOSE primitive (v2.0.0) — all composition patterns as pure async combinators, plus DAG-layer resolution.
---

# Compose

v2.0.0 completes the **COMPOSE** primitive: every composition pattern as a pure async
combinator over skill-step functions (`Step<I, O> = (input) => O | Promise<O>`). SigMap
covered sequential / parallel / map; SkillWeave adds reduce / conditional / loop, plus DAG
resolution. All in-process, no network.

```ts
import {
  sequential, parallel, mapPattern, reducePattern, conditional, loop, dagLayers,
} from "skillweave";
```

## Patterns

| Pattern | Signature | Behaviour |
|---|---|---|
| `sequential` | `(input, steps)` | Thread input through each step in order |
| `parallel` | `(input, branches)` | Run branches on the same input, await all |
| `mapPattern` | `(items, fn)` | Apply `fn` to each item concurrently |
| `reducePattern` | `(items, fn, init)` | Fold items into one accumulator |
| `conditional` | `(input, when, then, else?)` | Run `then` when `when(input)` holds, else `else` (or `undefined`) |
| `loop` | `(input, body, until, max?)` | Repeat `body` until `until(value, i)` or `maxIterations` (default 10) |

```ts
await sequential(1, [(x) => x + 1, (x) => x * 3]);     // 6
await parallel(5, [(x) => x + 1, (x) => x * 2]);       // [6, 10]
await reducePattern([1, 2, 3, 4], (a, b) => a + b, 0); // 10
await conditional(7, (x) => x > 5, () => "big", () => "small"); // "big"
await loop(1, (x) => x * 2, (v) => v >= 16);           // { value: 16, iterations: 4 }
```

## DAG resolution

`dagLayers(nodes)` orders nodes with `depends_on` into **layers** where every node's
dependencies sit in an earlier layer — so each layer's nodes can run in parallel. It throws on
a cycle or an unknown dependency.

```ts
dagLayers([
  { id: "a" },
  { id: "b", depends_on: ["a"] },
  { id: "c", depends_on: ["a"] },
  { id: "d", depends_on: ["b", "c"] },
]);
// → [["a"], ["b", "c"], ["d"]]
```

The combinators are host-facing building blocks; the orchestrator still runs a pipeline's
steps sequentially. Orchestrator-level DAG auto-execution is a planned follow-up.
