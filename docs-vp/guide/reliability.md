---
title: Reliability layer
description: SkillWeave's v0.2.0 reliability layer — confidence routing, an auto-inserted boundary judge, and retry-with-negative-context — applied to probabilistic skills only.
---

# Reliability layer

LLM skills are non-deterministic. The reliability layer (v0.2.0) handles that
systematically at every **probabilistic** boundary, while leaving deterministic skills
completely untouched. It lives in
[`src/orchestrator.ts`](https://github.com/manojmallick/skillweave/blob/main/src/orchestrator.ts).

## 1. Confidence routing

A probabilistic skill returns a `confidence` (0.0–1.0). The orchestrator routes it:

| Band | Range | Action |
|------|-------|--------|
| **high** | `≥ 0.85` | proceed |
| **review** | `0.65 – 0.85` | proceed, flag in the trace |
| **low** | `< 0.65` | retry |

## 2. Auto-judge

After a probabilistic skill produces output, the orchestrator **automatically** runs the
[boundary judge](/guide/providers) on the skill's `judge_blocks` — there is no manual
judge step in the pipeline. A judge score below the skill's `confidence_threshold`
(default `0.80`) is a failure.

## 3. Retry with negative context

When a probabilistic skill fails — low confidence, a failed assertion, or a judge
rejection — the orchestrator re-invokes it with **negative context**: the previous
summary plus the failure reason.

```
RetryContext = { attempt, previous_summary, failure_reason }
```

The retry budget is the skill's `retries` (default **2**). If all attempts fail, the
run **halts and exposes** the full diagnostic.

## Putting it together

The per-skill loop:

```
run skill (with retry context if this is a retry)
  → apply STATE writes + checkpoint
  → [probabilistic] confidence routing
  → assertions (base-assert)
  → [probabilistic] auto-judge on judge_blocks
  → pass?  record success, continue
  → fail?  retries left → re-invoke with negative context
           exhausted    → halt and expose
```

Deterministic skills run only the first three lines — **zero overhead**.

## Seeing it work

Each `--inject` mode drives one path:

```bash
npm start -- --inject lowconf
```
```
↻ extract-highlights probabilistic selected 4 highlights              0ms  $0.0000
  └─ confidence 0.60 below 0.65
✓ extract-highlights probabilistic selected 3 highlights (recovered on attempt 2)  0ms  $0.0000
  └─ judge: 1.00
STATUS: SUCCESS   total: 1ms   cost: $0.0000   retries: 1
```

| Mode | Trigger | Outcome |
|------|---------|---------|
| `lowconf` | confidence `0.60` < `0.65` | routing retries → recovers |
| `hallucination` | judge catches an ungrounded highlight | judge retries → recovers |
| `persistent` | every attempt stays ungrounded | retries exhausted → **HALTS** |
| `coverage` | deterministic assertion fails | **HALTS** immediately (no retry) |

## Golden anchors

Probabilistic skills declare `golden_anchors` — worked input/output examples of
acceptable output. They are threaded into the judge prompt so the model has a concrete
reference for what "grounded" looks like (the offline heuristic ignores them).
