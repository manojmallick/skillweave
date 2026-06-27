---
title: Roadmap
description: SkillWeave version roadmap — from the v0.1.0 prototype chain to the full COMPOSE + OBSERVE platform at v2.0.0.
---

# Roadmap

SkillWeave generalises SigMap's proven primitives into an open standard, shipped
version by version. Stats below reflect the current build.

**Stats:** 134 tests passing · 3 frozen base skills · 7 domain skills · 3 SigMap adapters · 4 provider adapters · 8 registry schemas · 4 capabilities · 3 trust tiers · 7 trigger types · 4 event types · 6 composition patterns · 19 CLI commands · 4 runtime deps

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

### v1.0.0 — Registry + public launch ✓

The first stable release. A tiered, quality-gated [skill registry](/guide/registry): the
9-point `gradeSkill` quality gate assigns a trust tier (`verified` / `community` /
`experimental`), each entry carries a quality-derived reputation, and a local-first store
(`.registry/skills.json`) backs `publish` / `install` / `registry`. The `src/index.ts` API
is now the supported integration surface.

**Tags:** skill catalog · 9-point quality gate · trust tiers · reputation · publish/install/registry · stable public API
**Impact:** 71-test `node:test` suite; skills can be graded, tiered, published, and installed locally. (Runtime reputation is seeded from the quality score; trace-history reputation is a follow-up.)

### v1.1.0 — Developer experience ✓

First-run onboarding so a Level 1 user never has to feel the runtime's depth.
`skillweave doctor` gives a one-command readiness report (Node · active judge provider or
the offline heuristic · registered skills · registry/artifacts), and the CLI now suggests
the closest match when a command or skill name is mistyped (`verfy` → `verify`).

**Tags:** skillweave doctor · runDoctor · did-you-mean · closest/levenshtein
**Impact:** 79-test `node:test` suite; a newcomer confirms "ready to run, offline" in one command, and typos guide instead of dead-end.

### v1.2.0 — TRIGGER + EVENT primitives ✓

The two activation/observability primitives, [local-first](/guide/triggers-events).
**TRIGGER** declares how a pipeline activates (`manual` / `cron` / `webhook` /
`pipeline_completion` + `condition` + `human_checkpoint`), with a pure 5-field `cronMatches`
and a `shouldActivate` resolver. **EVENT** is a typed signal model — an `EventBus` with
declarative `{ on, emit, notify, continue }` subscriptions that fan out across
`trace-log` / `webhook` / `human` routes; the orchestrator emits `low_confidence_detected` /
`skill_failed` / `pipeline_succeeded`. The loader parses + validates both pipeline blocks.

**Tags:** TriggerSpec · cronMatches · shouldActivate · EventBus · trace-log/webhook/human routes · continue=halt
**Impact:** 97-test `node:test` suite; pipelines declare activation and route typed signals — without any network or shell (delivery is the host's job).

### v1.3.0 — MEMORY primitive ✓

Pipelines [learn from past executions](/guide/memory). A local-first `MemoryStore` on
`.context/` records outcomes and failures and reads them back across sessions, with a **decay
model** (stale records stop informing adaptation), **last-write-wins** keyed records plus a
conflict log, and **failure-pattern learning** (`failurePatterns` / `recommend`). Skills
declare `memory_reads` / `memory_writes` (scoped writes, default-deny), and
`skillweave memory` surfaces the trend + recommendations.

**Tags:** MemoryStore · decay/isStale · conflict log · failurePatterns · recommend · per-skill scope · skillweave memory
**Impact:** 108-test `node:test` suite; the run log becomes adaptive knowledge — failure patterns and recommendations from real history, all local and offline.

### v2.0.0 — COMPOSE + OBSERVE ✓

The capstone. **COMPOSE** completes [all composition patterns](/guide/compose) as pure async
combinators — `sequential` / `parallel` / `mapPattern` / `reducePattern` / `conditional` /
`loop` — plus `dagLayers` for DAG resolution into parallelizable layers. **OBSERVE** adds the
local-first [observability layer](/guide/observe): `checkAlerts` threshold rules (routable via
the `EventBus`), `visualise` (ASCII/Mermaid pipeline diagrams + `skillweave visualise`), and
`abTest` skill-version comparison. This release also carries the v1.3.0 MEMORY primitive to a
published tag.

**Tags:** sequential/parallel/map/reduce/conditional/loop · dagLayers · checkAlerts · visualise · abTest · skillweave visualise
**Impact:** 120-test `node:test` suite; the v0.1 → v2.0 roadmap is complete — every primitive (CONTEXT · COST · OBSERVE · TRIGGER · COMPOSE · MEMORY · EVENT · SECURITY) shipped, all local-first.

### v2.0.1 — npm-publishable ✓

Packaging release. The runtime now compiles to `dist/` (JS + `.d.ts`), drops `private`, and
exposes a stable `main` / `exports` so it can be installed from npm and imported as a library.
Bundled data (schemas, provider profiles) resolves relative to the install, so a global CLI
works from any directory.

**Tags:** dist build · main/exports/types/files · package-relative data · dist-first bin
**Impact:** 123-test `node:test` suite; `import { runPipeline, EventBus, MemoryStore, … } from "skillweave"` once built.

### v2.0.1.x → v2.0.2 — published to npm ✓

The package is **live on npm** (`npm i skillweave`), published by a tag-gated workflow with
provenance. This patch also hardened the CLI: `run --doc` / `test --input` / `verify --input`
fail gracefully on a missing or malformed file (clean error + exit 2) instead of an uncaught
stack trace — found by running every feature end-to-end before publishing.

**Tags:** npm publish workflow · provenance · graceful CLI file errors · readArgFile
**Impact:** 126-test `node:test` suite; `npm i skillweave` works.

### v2.1.0 — todo-flagger skill + examples ✓

A sixth domain skill, `todo-flagger`, that flags content blocks containing a
`TODO` / `FIXME` / `XXX` marker — a complete worked example of
[authoring a skill](/guide/skill-contract): it extends `State` with a new `flags` field, adds
a `todo-flag@1.0` registry schema, and grades **9/9 → verified**. Plus eight runnable, offline
[examples](/guide/examples) (one per feature area) surfaced from the docs and README.

**Tags:** todo-flagger · new STATE field · todo-flag@1.0 schema · examples/ · Examples guide
**Impact:** 130-test `node:test` suite; 6 domain skills · 7 registry schemas; a copy-paste template for new skills.

### v2.2.0 — summarize skill ✓

A seventh domain skill, `summarize` — a **probabilistic** extractive summarizer that ranks
content blocks by salience and takes the top ones verbatim, so the auto-judge sees grounded
output. On a retry it takes fewer, stronger sentences, so a low-confidence first attempt
recovers — exercising the full [reliability layer](/guide/reliability) (confidence routing →
auto-judge → retry-with-negative-context) from a second skill (only `extract-highlights` did).

**Tags:** summarize · probabilistic · DocSummary · doc-summary@1.0 · confidence routing · retry-recovers
**Impact:** 134-test `node:test` suite; 7 domain skills (2 probabilistic) · 8 registry schemas.

## Planned

The published roadmap (v0.1 prototype → v2.0 COMPOSE + OBSERVE) is **complete**. Deferred,
host-facing extensions remain: a hosted observability dashboard and live alert/webhook
delivery (network), orchestrator-level DAG auto-execution, and published performance
benchmarks.

---

**Current milestone:** roadmap complete — v2.0.0 shipped. Next work is host-facing
(dashboard, live delivery) and an optional public npm publish.
