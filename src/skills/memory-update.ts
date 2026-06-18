// memory-update (deterministic) — maps to SigMap `learn`.
// Records which runs produced high judge scores into a local NDJSON log and
// reports whether this run improved on the prior average. No LLM call, no cloud.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemorySummary, Skill, State } from "../types.js";

const MEMORY_DIR = ".context";
const MEMORY_PATH = join(MEMORY_DIR, "skillweave-memory.ndjson");

interface MemoryRecord {
  ts: string;
  pipeline: string;
  judge_score: number;
  passed: boolean;
  num_blocks: number;
  block_types: string[];
}

function readRecords(): MemoryRecord[] {
  if (!existsSync(MEMORY_PATH)) return [];
  return readFileSync(MEMORY_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as MemoryRecord);
}

export const memoryUpdate: Skill = {
  name: "memory-update",
  execution_class: "deterministic",
  does: "records run outcomes locally and reports score improvement over time",
  does_not: "extract content, score groundedness, or call an LLM",
  state_read: ["judge", "content_blocks"],
  state_write: ["memory"],
  assertions: [
    {
      statement: "a memory record was persisted",
      check: (s: State) => ({
        statement: "a memory record was persisted",
        ok: (s.memory?.records_total ?? 0) > 0,
        detail: `${s.memory?.records_total ?? 0} records on disk`,
      }),
    },
  ],
  async run(state: State) {
    const prior = readRecords();
    const priorScores = prior.map((r) => r.judge_score);
    const avgPrior = priorScores.length
      ? priorScores.reduce((a, b) => a + b, 0) / priorScores.length
      : null;

    const blocks = state.content_blocks ?? [];
    const record: MemoryRecord = {
      ts: new Date().toISOString(),
      pipeline: state._meta.pipeline,
      judge_score: state.judge?.score ?? 0,
      passed: state.judge?.passed ?? false,
      num_blocks: blocks.length,
      block_types: [...new Set(blocks.map((b) => b.type))],
    };

    mkdirSync(MEMORY_DIR, { recursive: true });
    appendFileSync(MEMORY_PATH, JSON.stringify(record) + "\n");

    const all = [...priorScores, record.judge_score];
    const avgNow = all.reduce((a, b) => a + b, 0) / all.length;

    const memory: MemorySummary = {
      records_total: all.length,
      avg_score_prior: avgPrior !== null ? Number(avgPrior.toFixed(3)) : null,
      avg_score_now: Number(avgNow.toFixed(3)),
      improved: avgPrior !== null ? record.judge_score >= avgPrior : null,
      path: MEMORY_PATH,
    };

    const trend =
      memory.improved === null
        ? "first run"
        : memory.improved
          ? "improved/steady"
          : "regressed";
    return {
      writes: { memory },
      summary: `${memory.records_total} records, ${trend}`,
      cost: 0,
    };
  },
};
