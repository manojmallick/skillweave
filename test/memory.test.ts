// MEMORY primitive (v1.3.0) — store, decay, conflict log, learning, scope, loader.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import {
  DEFAULT_MAX_AGE_MS,
  failurePatterns,
  isStale,
  MemoryScopeError,
  MemoryStore,
  recommend,
} from "../src/index.js";
import { validatePipelineDoc } from "../src/pipeline-loader.js";
import { parseInput } from "../src/skills/parse-input.js";

const PATH = ".context/mem-test.ndjson";
const CONFLICTS = ".context/mem-test.conflicts.ndjson";
const AT = (iso: string) => () => new Date(iso);
const NOW = "2026-06-27T12:00:00.000Z";
function clean() {
  rmSync(PATH, { force: true });
  rmSync(CONFLICTS, { force: true });
}
function freshStore() {
  clean();
  return new MemoryStore({ path: PATH, now: AT(NOW) });
}

// 1. record / recall across "sessions" (separate store instances, same file).
test("MemoryStore: record then recall across instances", () => {
  const s = freshStore();
  try {
    s.record({ pipeline: "p", kind: "outcome", judge_score: 1, passed: true });
    const reopened = new MemoryStore({ path: PATH, now: AT(NOW) });
    assert.equal(reopened.recall({ pipeline: "p" }).length, 1);
  } finally {
    clean();
  }
});

test("MemoryStore: reads legacy records without a kind as outcomes", () => {
  const s = freshStore();
  try {
    // a record shaped like what `memory-update` writes (no `kind`)
    s.record({ pipeline: "p", judge_score: 0.9, passed: true } as never);
    assert.equal(s.stats("p").runs, 1);
  } finally {
    clean();
  }
});

// 2. stats.
test("MemoryStore.stats: aggregates score, pass rate, failures", () => {
  const s = freshStore();
  try {
    s.record({ pipeline: "p", kind: "outcome", judge_score: 1, passed: true });
    s.record({ pipeline: "p", kind: "outcome", judge_score: 0, passed: false });
    s.record({ pipeline: "p", kind: "failure", skill: "x", reason: "judge low" });
    const st = s.stats("p");
    assert.equal(st.runs, 2);
    assert.equal(st.avg_score, 0.5);
    assert.equal(st.pass_rate, 0.5);
    assert.equal(st.failures, 1);
  } finally {
    clean();
  }
});

// 3. decay.
test("isStale: respects the threshold", () => {
  const now = new Date(NOW);
  assert.equal(isStale("2020-01-01T00:00:00Z", now), true);
  assert.equal(isStale(NOW, now), false);
  assert.equal(isStale("not-a-date", now), true);
  assert.ok(DEFAULT_MAX_AGE_MS > 0);
});

test("MemoryStore: recall excludes stale records by default", () => {
  const s = freshStore();
  try {
    s.record({ pipeline: "p", kind: "outcome", judge_score: 1, ts: "2020-01-01T00:00:00.000Z" });
    s.record({ pipeline: "p", kind: "outcome", judge_score: 1 });
    assert.equal(s.recall({ pipeline: "p" }).length, 1);
    assert.equal(s.recall({ pipeline: "p", includeStale: true }).length, 2);
  } finally {
    clean();
  }
});

// 4. concurrent-write safety.
test("MemoryStore: keyed writes are last-write-wins with a conflict log", () => {
  const s = freshStore();
  try {
    s.record({ pipeline: "p", key: "k", kind: "outcome", judge_score: 0.5, ts: "2026-06-27T10:00:00.000Z" });
    s.record({ pipeline: "p", key: "k", kind: "outcome", judge_score: 0.9, ts: "2026-06-27T11:00:00.000Z" });
    const keyed = s.all({ includeStale: true }).filter((r) => r.key === "k");
    assert.equal(keyed.length, 1);
    assert.equal(keyed[0]?.judge_score, 0.9);
    assert.equal(s.conflicts().length, 1);
  } finally {
    clean();
  }
});

// 5. learning.
test("failurePatterns: groups by skill + reason", () => {
  const recs = [
    { ts: NOW, pipeline: "p", kind: "failure" as const, skill: "x", reason: "a" },
    { ts: NOW, pipeline: "p", kind: "failure" as const, skill: "x", reason: "a" },
    { ts: NOW, pipeline: "p", kind: "failure" as const, skill: "y", reason: "b" },
  ];
  const p = failurePatterns(recs);
  assert.equal(p[0]?.count, 2);
  assert.equal(p[0]?.skill, "x");
});

test("recommend: surfaces low pass rate and patterns", () => {
  const recs = recommend({
    pipeline: "p", runs: 4, avg_score: 0.3, pass_rate: 0.25, failures: 3,
    patterns: [{ skill: "x", reason: "judge low", count: 3 }],
  });
  assert.ok(recs.some((r) => /low pass rate/.test(r)));
  assert.ok(recs.some((r) => /x failed 3/.test(r)));
});

// 6. per-skill write scope.
test("MemoryStore.scopedTo: refuses an undeclared write key", () => {
  const s = freshStore();
  try {
    const scoped = s.scopedTo({ ...parseInput, memory_writes: ["allowed"] });
    assert.throws(() => scoped.record({ pipeline: "p", key: "nope", kind: "outcome" }), MemoryScopeError);
    const ok = scoped.record({ pipeline: "p", key: "allowed", kind: "outcome", judge_score: 1 });
    assert.equal(ok.key, "allowed");
  } finally {
    clean();
  }
});

// 7. loader + CLI.
test("loader: parses and validates step memory", () => {
  const good = validatePipelineDoc({
    name: "x", version: "1", domain: "d",
    pipeline: [{ skill: "memory-update", memory: { reads: ["a"], writes: ["b"] } }],
  });
  assert.equal(good.filter((i) => i.level === "error").length, 0);
  const bad = validatePipelineDoc({
    name: "x", version: "1", domain: "d",
    pipeline: [{ skill: "memory-update", memory: { writes: "notalist" } }],
  });
  assert.ok(bad.some((i) => i.level === "error" && /memory/.test(i.message)));
});

test("cli memory: exits 0", async () => {
  assert.equal(await cli(["memory"]), 0);
});
