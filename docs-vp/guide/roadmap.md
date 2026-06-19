---
title: Roadmap
description: SkillWeave version roadmap — from the v0.1.0 prototype chain to the full COMPOSE + OBSERVE platform at v2.0.0.
---

# Roadmap

SkillWeave generalises SigMap's proven primitives into an open standard, shipped
version by version. Stats below reflect the current build.

**Stats:** 21 tests passing · 3 frozen base skills · 4 domain skills · 6 CLI commands · 3 judge providers · 4 runtime deps

## Shipped

### v0.1.0 — Prototype chain ✓

The 4-skill chain proving the mechanics end to end:
`parse-input → validate-coverage → boundary-judge → memory-update`. Core primitives
(SKILL, PIPELINE, STATE, ASSERTION), the three frozen base skills, a multi-LLM boundary
judge with an offline heuristic fallback, NDJSON tracing, and STATE checkpoints.

**Tags:** prototype · ask→validate→judge→learn · multi-LLM judge
**Impact:** runs end to end offline; failure caught and surfaced with full diagnostics.

### v0.2.0 — Reliability layer ✓

Systematic non-determinism handling at the probabilistic boundary: confidence routing
(`≥0.85` / `0.65–0.85` / `<0.65`), an auto-inserted boundary judge, and
retry-with-negative-context (budget 2). Golden anchors in the skill contract; the
`extract-highlights` probabilistic skill; deterministic skills stay overhead-free.

**Tags:** confidence routing · auto-judge · retry-with-negative-context · golden anchors
**Impact:** failing probabilistic skills recover instead of halting.

### v0.3.0 — Production runtime ✓

A real runtime driven by a `skillweave` CLI: a pipeline YAML loader that resolves each
step against a skill registry (with per-step `confidence_threshold` / `retries`
overrides), and the commands `run` · `validate` · `test` · `list` · `trace` · `new`,
plus an installable bin.

**Tags:** skillweave CLI · pipeline YAML loader · skill registry · bin
**Impact:** 21-test `node:test` suite; pipelines are declared in YAML and run/validated from the CLI. (Full JSON-schema registry with version resolution deferred to v0.6.0.)

## Planned

### v0.4.0 — SigMap adapters → current milestone

Extract SigMap primitives as SkillWeave standard adapters (CONTEXT, COST, OBSERVE,
TRIGGER, MEMORY, EVENT) — wrappers, not rebuilds.

### v0.5.0 — Multi-LLM provider layer

A formal `LLMProviderAdapter` interface, provider-profile YAML, primary + fallback
executors, and a neutral-language validator. (The judge is already provider-pluggable
across Claude / Gemini / OpenAI today.)

### v0.6.0 — Schema governance

Semantic versioning on all schemas, additive-only enforcement, and a `check-schemas`
command that catches breaking changes before execution.

### v0.7.0 — Security model

Per-skill permission scoping, sandboxed execution for community/experimental skills, and
SigMap-inherited secret scanning in the pipeline.

### v0.8.0 — SigMap pipeline integration

SkillWeave becomes SigMap's internal execution architecture via the `sigmap-verify`
pipeline.

### v1.0.0 — Registry + public launch

Tiered registry (Verified / Community / Experimental), a 9-point quality gate, runtime
reputation, and `publish` / `install`.

### v2.0.0 — COMPOSE + OBSERVE

All composition patterns (reduce / conditional / loop / DAG) and the full observability
platform (alerts, replay, A/B skill testing).

---

**Current milestone:** v0.4.0 — SigMap adapters (CONTEXT / COST / OBSERVE wrappers).
