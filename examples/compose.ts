// compose — all composition patterns as pure async combinators, plus DAG resolution.
//
// As a published consumer: import { sequential, parallel, ... } from "skillweave";
import {
  conditional,
  dagLayers,
  loop,
  mapPattern,
  parallel,
  reducePattern,
  sequential,
} from "../src/index.js";

// Toy async "steps" (imagine each is a skill / API call).
const inc = async (x: number) => x + 1;
const dbl = async (x: number) => x * 2;

console.log("sequential   :", await sequential(1, [inc, dbl, dbl])); // ((1+1)*2)*2 = 8
console.log("parallel     :", await parallel(10, [inc, dbl])); // [11, 20]
console.log("mapPattern   :", await mapPattern([1, 2, 3, 4], dbl)); // [2,4,6,8]
console.log("reducePattern:", await reducePattern([1, 2, 3, 4], async (a, b) => a + b, 0)); // 10

const label = await conditional(7, (n) => n > 5, async () => "big", async () => "small");
console.log("conditional  :", label); // big

const grown = await loop(1, dbl, (v) => v >= 100); // 1→2→4→…→128
console.log("loop         :", grown); // { value: 128, iterations: 7 }

// DAG: order steps with dependencies into parallelizable layers.
const layers = dagLayers([
  { id: "fetch" },
  { id: "parse", depends_on: ["fetch"] },
  { id: "lint", depends_on: ["fetch"] },
  { id: "report", depends_on: ["parse", "lint"] },
]);
console.log("dagLayers    :", JSON.stringify(layers)); // [["fetch"],["parse","lint"],["report"]]
