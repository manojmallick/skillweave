---
title: Memory
description: SkillWeave's MEMORY primitive (v1.3.0) — a local-first adaptive store on .context/ so pipelines learn from past executions, with decay, a conflict log, and failure-pattern learning.
---

# Memory

v1.3.0 turns the run-outcome log into a **MEMORY primitive**: persistent, adaptive knowledge
stored on `.context/` so pipelines learn from past executions. Local-first — `MemoryStore`
reads and writes a JSON-lines file with no network, and is back-compatible with the records
the [`memory-update`](/guide/primitives) skill already writes.

## MemoryStore

```ts
import { MemoryStore } from "skillweave";

const store = new MemoryStore();                 // .context/skillweave-memory.ndjson
store.record({ pipeline: "p", kind: "outcome", judge_score: 0.9, passed: true });
store.recall({ pipeline: "p" });                 // fresh records (decay applied)
store.stats("p");                                // { runs, avg_score, pass_rate, failures, patterns }
```

| Method | Purpose |
|---|---|
| `record(rec)` | Append a timestamped record |
| `all(opts)` / `recall(opts)` | Read records, filtered by pipeline / skill / kind |
| `stats(pipeline)` | Aggregate runs · avg score · pass rate · failures · patterns |
| `conflicts()` | The keyed-write conflict audit trail |
| `scopedTo(skill)` | A store that only writes the skill's declared keys |

## Decay

Records older than a staleness threshold no longer inform adaptation. `recall` and `stats`
exclude them by default:

```ts
import { isStale, DEFAULT_MAX_AGE_MS } from "skillweave";   // default 30 days
isStale(record.ts, new Date());                              // true once stale
store.recall({ pipeline: "p", includeStale: true });         // opt back in
```

## Concurrent-write safety

Records may carry a `key`. The keyed view is **last-write-wins** (the latest `ts` wins); a
colliding keyed write is appended to `.context/skillweave-memory.conflicts.ndjson` so nothing
is lost silently — read it back with `store.conflicts()`.

## Cross-session learning

`failurePatterns` groups failure records by skill + reason; `recommend` turns a pipeline's
stats into plain-language guidance:

```ts
import { failurePatterns, recommend } from "skillweave";

failurePatterns(store.all({ kind: "failure" }));   // [{ skill, reason, count }, ...]
recommend(store.stats("p"));                        // ["extract-highlights failed 3× — ...", ...]
```

`skillweave memory [pipeline]` prints exactly this — the trend, pass rate, failure patterns,
and recommendations. See the [CLI guide](/guide/cli#memory).

## Per-skill scope

A skill declares the memory keys it may touch, and a pipeline step can scope them:

```yaml
pipeline:
  - skill: memory-update
    memory:
      reads:  [score_trend]
      writes: [run_outcome]
```

`MemoryStore.scopedTo(skill)` refuses a write to any key outside `memory_writes` — the same
default-deny posture as the STATE write-scope and the [security model](/guide/security).
