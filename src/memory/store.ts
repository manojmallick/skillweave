// MemoryStore — a local-first, append-only NDJSON store on `.context/`. Reads
// the records the `memory-update` skill already writes, and adds recall (with
// decay), aggregate stats, failure-pattern learning, last-write-wins keying with
// a conflict log, and per-skill write scope. No network.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Skill } from "../types.js";
import { DEFAULT_MAX_AGE_MS, isStale } from "./decay.js";
import { failurePatterns } from "./learn.js";
import type { MemoryRecord, MemoryStats, RecallOptions } from "./types.js";

const DEFAULT_PATH = join(".context", "skillweave-memory.ndjson");

/** Raised when a scoped store is asked to write an undeclared memory key. */
export class MemoryScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryScopeError";
  }
}

export interface MemoryStoreOptions {
  path?: string;
  now?: () => Date;
  maxAgeMs?: number;
}

export class MemoryStore {
  private readonly path: string;
  private readonly conflictsPath: string;
  private readonly now: () => Date;
  private readonly maxAgeMs: number;

  constructor(opts: MemoryStoreOptions = {}) {
    this.path = opts.path ?? DEFAULT_PATH;
    this.conflictsPath = this.path.replace(/\.ndjson$/, "") + ".conflicts.ndjson";
    this.now = opts.now ?? (() => new Date());
    this.maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  }

  private readFile(path: string): MemoryRecord[] {
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MemoryRecord);
  }

  private append(path: string, rec: MemoryRecord): void {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(rec) + "\n");
  }

  /** Append a record (stamping `ts` when absent). Keyed collisions are logged. */
  record(rec: Omit<MemoryRecord, "ts"> & { ts?: string }): MemoryRecord {
    const stamped: MemoryRecord = { ...rec, ts: rec.ts ?? this.now().toISOString() };
    if (stamped.key && this.readFile(this.path).some((r) => r.key === stamped.key)) {
      this.append(this.conflictsPath, stamped); // last-write-wins; keep an audit trail
    }
    this.append(this.path, stamped);
    return stamped;
  }

  /** Every fresh record matching the options (latest-per-key when keyed). */
  all(opts: RecallOptions = {}): MemoryRecord[] {
    const now = this.now();
    let recs = this.readFile(this.path).map((r) => ({ ...r, kind: r.kind ?? "outcome" }));
    if (opts.pipeline) recs = recs.filter((r) => r.pipeline === opts.pipeline);
    if (opts.skill) recs = recs.filter((r) => r.skill === opts.skill);
    if (opts.kind) recs = recs.filter((r) => r.kind === opts.kind);
    if (!opts.includeStale) recs = recs.filter((r) => !isStale(r.ts, now, this.maxAgeMs));
    return collapseByKey(recs);
  }

  /** Alias for `all` — reads relevant prior knowledge. */
  recall(opts: RecallOptions = {}): MemoryRecord[] {
    return this.all(opts);
  }

  /** Aggregate learning over one pipeline's fresh history. */
  stats(pipeline: string): MemoryStats {
    const recs = this.all({ pipeline });
    const outcomes = recs.filter((r) => r.kind === "outcome");
    const failures = recs.filter((r) => r.kind === "failure");
    const scores = outcomes.map((r) => r.judge_score).filter((s): s is number => s != null);
    const passes = outcomes.map((r) => r.passed).filter((p): p is boolean => p != null);
    return {
      pipeline,
      runs: outcomes.length,
      avg_score: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)) : null,
      pass_rate: passes.length ? Number((passes.filter(Boolean).length / passes.length).toFixed(3)) : null,
      failures: failures.length,
      patterns: failurePatterns(failures),
    };
  }

  /** Recorded keyed-write conflicts (the audit trail). */
  conflicts(): MemoryRecord[] {
    return this.readFile(this.conflictsPath);
  }

  /** A store that only permits writes to the skill's declared `memory_writes`. */
  scopedTo(skill: Skill): MemoryStore {
    const allowed = new Set(skill.memory_writes ?? []);
    const parent = this;
    const scoped = Object.create(MemoryStore.prototype) as MemoryStore;
    Object.assign(scoped, parent);
    scoped.record = (rec) => {
      if (!rec.key || !allowed.has(rec.key)) {
        throw new MemoryScopeError(
          `skill "${skill.name}" may only write memory keys [${[...allowed].join(", ")}] — got "${rec.key ?? "(none)"}"`,
        );
      }
      return parent.record(rec);
    };
    return scoped;
  }
}

/** Keep only the latest-ts record per key; unkeyed records all pass through. */
function collapseByKey(recs: MemoryRecord[]): MemoryRecord[] {
  const latest = new Map<string, MemoryRecord>();
  const out: MemoryRecord[] = [];
  for (const r of recs) {
    if (!r.key) {
      out.push(r);
      continue;
    }
    const prev = latest.get(r.key);
    if (!prev || Date.parse(r.ts) >= Date.parse(prev.ts)) latest.set(r.key, r);
  }
  return [...out, ...latest.values()];
}
