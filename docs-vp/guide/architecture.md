---
title: Architecture
description: How the SkillWeave runtime is wired — orchestrator, frozen base skills, STATE, the boundary judge, and the NDJSON trace.
---

# Architecture

SkillWeave executes a **pipeline** of **skills** that read and write a shared, typed
**STATE** object. The orchestrator drives execution, the three frozen base skills
provide transport / assertion / logging, and a boundary judge validates probabilistic
output.

## The chain

```
parse-input  →  validate-coverage  →  extract-highlights  →  memory-update
(sigmap ask)    (sigmap validate)     (probabilistic)         (sigmap learn)
                                      ↑ auto-judged · confidence-routed · retried
```

This maps SigMap's production **ask → validate → judge → learn** workflow onto the
document domain — the same pattern, a different domain.

## Components

| File | Role |
|------|------|
| [`src/orchestrator.ts`](https://github.com/manojmallick/skillweave/blob/main/src/orchestrator.ts) | Drives the pipeline; owns confidence routing, auto-judge, and retry |
| [`src/types.ts`](https://github.com/manojmallick/skillweave/blob/main/src/types.ts) | The primitive types: SKILL, PIPELINE, STATE, ASSERTION + reliability types |
| [`src/judge.ts`](https://github.com/manojmallick/skillweave/blob/main/src/judge.ts) | Multi-LLM boundary judge + offline heuristic fallback |
| `src/base/base-io.ts` | **(frozen)** STATE writes (scope-enforced) + checkpoints |
| `src/base/base-assert.ts` | **(frozen)** runs declared assertions; failure halts |
| `src/base/base-log.ts` | **(frozen)** NDJSON trace + execution summary |
| `src/skills/*.ts` | The four domain skills of the reference chain |

## STATE

STATE is a single typed object threaded between skills. Each field is written only by
its owning skill, and `base-io` **enforces the write scope** — a skill that writes a
field it didn't declare in `state_write` throws. The framework-managed `_meta` block
carries the pipeline name, run id, and checkpoint list.

After every skill, `base-io` writes an immutable STATE checkpoint to
`traces/checkpoints/`, giving you a step-by-step snapshot of execution.

## Execution loop

For each skill the orchestrator:

1. runs the skill (passing negative context on a retry);
2. applies its declared STATE writes via `base-io` and checkpoints;
3. for **probabilistic** skills only — routes on confidence, runs the boundary judge,
   and retries with negative context on failure (see [Reliability](/guide/reliability));
4. runs the skill's assertions via `base-assert`;
5. records a trace row via `base-log`.

Deterministic skills skip step 3 entirely — **zero reliability overhead**.

## Observability

`base-log` writes one NDJSON line per attempt to `traces/<run-id>.ndjson`, in a format
compatible with SigMap's `usage.ndjson`:

```json
{"ts":"…","pipeline":"document-grounding","skill":"extract-highlights","class":"probabilistic","duration_ms":1,"cost":0,"judge_score":1,"confidence":0.9,"confidence_band":"high","attempt":1,"status":"success","summary":"selected 3 highlights"}
```

The execution summary is always printed; on failure it auto-exposes full diagnostics
(which skill, which assertion, the judge score, cost so far). Everything is local —
**zero telemetry**.

## Design principles

- **Base skills are frozen** — no domain logic ever enters `base-io` / `base-assert` / `base-log`.
- **Composition over inheritance** — skills declare what they *use*, not what they extend.
- **Classify before mitigating** — deterministic skills get no judge, routing, or retry.
- **Transparency on failure** — the failure path is never silent.
