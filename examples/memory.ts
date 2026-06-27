// memory — pipelines learn from past executions. Record outcomes + failures,
// recall across "sessions", aggregate stats, decay, conflict log, and learning.
//
// As a published consumer: import { MemoryStore, failurePatterns, recommend } from "skillweave";
import { rmSync } from "node:fs";
import { failurePatterns, isStale, MemoryStore, recommend } from "../src/index.js";

const PATH = ".context/example-memory.ndjson";
rmSync(PATH, { force: true });
rmSync(PATH.replace(".ndjson", ".conflicts.ndjson"), { force: true });

// A fixed clock keeps the demo deterministic.
const store = new MemoryStore({ path: PATH, now: () => new Date("2026-06-27T12:00:00Z") });

// Record a few runs (outcomes) and some failures.
store.record({ pipeline: "p", kind: "outcome", judge_score: 1, passed: true });
store.record({ pipeline: "p", kind: "outcome", judge_score: 0, passed: false });
store.record({ pipeline: "p", kind: "failure", skill: "extract-highlights", reason: "ungrounded" });
store.record({ pipeline: "p", kind: "failure", skill: "extract-highlights", reason: "ungrounded" });

// A *different* session (new store instance, same file) still sees the history.
const reopened = new MemoryStore({ path: PATH, now: () => new Date("2026-06-27T12:00:00Z") });
const stats = reopened.stats("p");
console.log("stats        :", JSON.stringify(stats));
console.log("patterns     :", JSON.stringify(failurePatterns(reopened.all({ kind: "failure" }))));
console.log("recommend    :", recommend(stats));

// Decay: an old record stops informing adaptation.
console.log("isStale(2020):", isStale("2020-01-01T00:00:00Z", new Date("2026-06-27T12:00:00Z")));

// Concurrent-write safety: keyed writes are last-write-wins + a conflict log.
store.record({ pipeline: "p", key: "summary", kind: "outcome", judge_score: 0.5, ts: "2026-06-27T10:00:00Z" });
store.record({ pipeline: "p", key: "summary", kind: "outcome", judge_score: 0.9, ts: "2026-06-27T11:00:00Z" });
const summary = store.all({ includeStale: true }).find((r) => r.key === "summary");
console.log("keyed winner :", summary?.judge_score, "| conflicts:", store.conflicts().length);

rmSync(PATH, { force: true });
rmSync(PATH.replace(".ndjson", ".conflicts.ndjson"), { force: true });
