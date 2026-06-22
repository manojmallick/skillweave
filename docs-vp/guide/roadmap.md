---
title: Roadmap
description: SkillWeave version roadmap — from the v0.1.0 prototype chain to the full COMPOSE + OBSERVE platform at v2.0.0.
---

# Roadmap

SkillWeave generalises SigMap's proven primitives into an open standard, shipped
version by version. Stats below reflect the current build.

**Stats:** 63 tests passing · 3 frozen base skills · 5 domain skills · 3 SigMap adapters · 4 provider adapters · 6 registry schemas · 4 capabilities · 13 CLI commands · 4 runtime deps

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
**Impact:** pipelines are declared in YAML and run/validated from the CLI. (Full JSON-schema registry with version resolution deferred to v0.6.0.)

### v0.4.0 — SigMap adapters ✓

The [SigMap adapter layer](/guide/adapters): `ContextProvider` / `CostManager` /
`ObservabilityProvider` interfaces with implementations that **wrap SigMap's local
artifacts** (the `.context/` directory and the SigMap `usage.ndjson`-compatible metric
stream) — no shell spawn, no rebuild. OBSERVE computes a composite 0–100 health score on
SigMap's grade scale, surfaced via `skillweave health` and a footer on every run.

**Tags:** CONTEXT · COST · OBSERVE · skillweave health · sigmap command
**Impact:** health grading from the shared NDJSON contract. (TRIGGER / EVENT / MEMORY adapters and `install @sigmap/adapters` deferred to later milestones.)

### v0.5.0 — Multi-LLM provider layer ✓

A formal [`LLMProviderAdapter`](/guide/providers) interface with `anthropic` / `google`
/ `openai` / `ollama` adapters, capability profiles in `provider-profiles/*.profile.yaml`,
an executor that auto-selects a model by tier + required capabilities and runs
**primary → fallback**, and a Neutral Skill Language validator. The boundary judge now
routes its LLM call through the layer.

**Tags:** LLMProviderAdapter · provider profiles · primary→fallback executor · neutral-language validator
**Impact:** the same pipeline runs on any configured provider, with capability-driven model selection and automatic fallback.

### v0.6.0 — Schema governance ✓

A [versioned schema registry](/guide/schemas) (`schemas/registry/<name>@<version>.json`),
`input_schema` / `output_schema` pins on skills, a schema differ (additive vs breaking),
an additive-only rule across same-major versions, and `skillweave check-schemas` to catch
breaking changes before they ship.

**Tags:** versioned registry · schema pins · diffSchemas · additive-only · check-schemas
**Impact:** 43-test `node:test` suite; schema changes are governed — a removed/retyped/newly-required field within a major fails the gate.

### v0.7.0 — Security model ✓

A per-skill [security model](/guide/security): a capability vocabulary
(`fs:read` · `fs:write` · `net` · `env:read`), a default-deny `SecurityPolicy`, and a
filesystem sandbox (`guardWrite`) that contains writes within the policy's roots and
blocks `../` traversal. Skills declare a `capabilities` field; the orchestrator runs a
pre-flight permission check and halts an over-privileged skill — with secret-redacted
diagnostics — before it executes. `skillweave check-permissions` audits the whole
registry against the policy.

**Tags:** capability permissions · default-deny · guardWrite sandbox · redactSecrets · check-permissions
**Impact:** 56-test `node:test` suite; a skill can do only what its declared capabilities allow, enforced before execution. Pure skills carry zero overhead.

### v0.8.0 — SigMap pipeline integration ✓

SkillWeave becomes SigMap's internal execution architecture. A [`load-context`](/guide/sigmap-verify)
skill sources `raw_input` from SigMap's CONTEXT artifact, the `sigmap-verify` pipeline runs
the ask→validate→judge→learn verify flow, and `runSigMapVerify()` (exported from
`src/index.ts`) returns a structured `VerifyResult` so SigMap can embed the runtime
in-process — no shell spawn, no CLI. Also `skillweave verify`.

**Tags:** load-context · sigmap-verify pipeline · runSigMapVerify · VerifyResult · public API barrel · check verify
**Impact:** 63-test `node:test` suite; SigMap consumes SkillWeave as a library, verifying its own context through the same reliability layer.

## Planned

### v1.0.0 — Registry + public launch

Tiered registry (Verified / Community / Experimental), a 9-point quality gate, runtime
reputation, and `publish` / `install`.

### v2.0.0 — COMPOSE + OBSERVE

All composition patterns (reduce / conditional / loop / DAG) and the full observability
platform (alerts, replay, A/B skill testing).

---

**Current milestone:** v1.0.0 — registry + public launch (tiered registry, a quality gate, runtime reputation, and `publish` / `install`).
