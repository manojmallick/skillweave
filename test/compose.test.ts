// COMPOSE primitive (v2.0.0) — composition patterns + DAG resolution.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conditional,
  dagLayers,
  loop,
  mapPattern,
  parallel,
  reducePattern,
  sequential,
} from "../src/index.js";

test("sequential: threads input through steps", async () => {
  assert.equal(await sequential(1, [(x) => x + 1, (x) => x * 3]), 6);
  assert.equal(await sequential("a", []), "a");
});

test("parallel: runs branches on one input and awaits all", async () => {
  assert.deepEqual(await parallel(5, [(x) => x + 1, async (x) => x * 2]), [6, 10]);
});

test("mapPattern / reducePattern: map then fold", async () => {
  assert.deepEqual(await mapPattern([1, 2, 3], (x) => x * x), [1, 4, 9]);
  assert.equal(await reducePattern([1, 2, 3, 4], (a, b) => a + b, 0), 10);
});

test("conditional: branches on the predicate", async () => {
  assert.equal(await conditional(7, (x) => x > 5, () => "big", () => "small"), "big");
  assert.equal(await conditional(2, (x) => x > 5, () => "big", () => "small"), "small");
  assert.equal(await conditional(2, (x) => x > 5, () => "big"), undefined);
});

test("loop: repeats until the exit predicate or maxIterations", async () => {
  const r = await loop(1, (x) => x * 2, (v) => v >= 16);
  assert.deepEqual(r, { value: 16, iterations: 4 });
  const capped = await loop(1, (x) => x + 1, () => false, 3);
  assert.equal(capped.iterations, 3);
});

test("dagLayers: orders dependencies into parallelizable layers", () => {
  const layers = dagLayers([
    { id: "a" },
    { id: "b", depends_on: ["a"] },
    { id: "c", depends_on: ["a"] },
    { id: "d", depends_on: ["b", "c"] },
  ]);
  assert.deepEqual(layers, [["a"], ["b", "c"], ["d"]]);
});

test("dagLayers: throws on a cycle and on an unknown dependency", () => {
  assert.throws(() => dagLayers([{ id: "x", depends_on: ["y"] }, { id: "y", depends_on: ["x"] }]), /cycle/);
  assert.throws(() => dagLayers([{ id: "a", depends_on: ["missing"] }]), /unknown node/);
});
