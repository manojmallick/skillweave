# Changelog

All notable changes to SkillWeave are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] — 2026-06-21

### Added
- Security model (#17) under `src/security/` — a per-skill capability vocabulary (`fs:read` · `fs:write` · `net` · `env:read`) and a default-deny `SecurityPolicy`.
- `DEFAULT_POLICY` grants only what the reference pipeline needs (`fs:read`/`fs:write`) and confines filesystem writes to the `traces/` and `.context/` roots.
- `checkSkillPermissions` / `auditSkills` — a skill is permitted only if every declared capability is known and granted by the active policy.
- `guardWrite` — a filesystem sandbox that asserts the `fs:write` capability and contains writes within the policy's roots, blocking `../` traversal escapes.
- `redactSecrets` — scrubs provider API-key values from any string before it can reach a diagnostic or trace.
- Skill contract gains an optional `capabilities` field; the four reference skills declare theirs (`memory-update` = `fs:read` + `fs:write`, routed through `guardWrite`).
- CLI: `skillweave check-permissions` — audits every registered skill against `DEFAULT_POLICY`; exits non-zero on any ungranted or unknown capability.

### Changed
- The orchestrator runs a pre-flight permission check before each skill and halts an over-privileged skill — with secret-redacted diagnostics — without executing it. Pure skills carry zero overhead.

## [0.6.0] — 2026-06-19

### Added
- Versioned schema registry (#13) at `schemas/registry/<name>@<version>.json`, with a loader (`parseRef` / `loadSchema` / `listVersions`).
- Schema differ — `diffSchemas(from, to)` classifies a change as additive (compatible) or breaking (removed / retyped / newly-required field), with a structured diff.
- Additive-only rule enforced across consecutive versions of a schema within the same major.
- Skill contract pins — `input_schema` / `output_schema` (`name@version`); the four reference skills pin to registry schemas.
- CLI: `skillweave check-schemas` — verifies every schema parses, every pin resolves, and the additive-only rule holds; exits non-zero on a breaking change within a major.

## [0.5.0] — 2026-06-19

### Added
- Multi-LLM provider layer (#10) under `src/providers/` — an `LLMProviderAdapter` interface (`supports` / `selectModel` / `complete`) with `anthropic`, `google`, `openai`, and `ollama` (local, via `fetch`) adapters.
- Provider capability profiles in `provider-profiles/*.profile.yaml` (model tier, context window, structured-output support, per-1k cost) + a loader.
- Executor with auto model selection by tier + required capabilities and **primary → fallback** execution (`resolveTargets` / `runWithFallback`).
- Neutral Skill Language validator — flags model/vendor names, thinking-block / XML syntax, and context-window assumptions.
- Pipeline `executor` field (primary + fallback + requires) parsed by the loader.
- CLI: `skillweave providers` and `skillweave neutral <file>`.

### Changed
- The boundary judge routes its LLM call through the provider layer (primary → fallback → offline heuristic); the judge's default model is now the provider's `balanced` tier (env model overrides still honored).

## [0.4.0] — 2026-06-19

### Added
- SigMap adapter layer (#7) under `src/adapters/` — `ContextProvider` / `CostManager` / `ObservabilityProvider` interfaces with SigMap-backed implementations that wrap local artifacts (the `.context/` directory and the SigMap `usage.ndjson`-compatible metric stream). No shell spawn, no rebuild.
- OBSERVE — composite 0–100 health score on SigMap's grade scale (A≥90 · B≥75 · C≥60 · D<60), surfaced via `skillweave health` and a footer on every run.
- CONTEXT — loads SigMap's `.context/query-context.md` (graceful no-op when absent).
- COST — model-tier routing (`fast` / `balanced` / `powerful`) and per-run cost from traces.
- CLI: `skillweave health` and `skillweave sigmap context | cost | health`.

## [0.3.0] — 2026-06-19

### Added
- `skillweave` CLI (#4): `run` · `validate` · `test` · `list` · `trace` · `new` — exit-code based and unit-testable.
- Pipeline YAML loader — parses a `.pipeline.yaml` into a runnable `Pipeline`, resolving each step's `skill` against the registry and applying `confidence_threshold` / `retries` overrides without mutating the registered skill.
- Skill registry mapping skill names to implementations.
- Installable `skillweave` bin (`bin/skillweave.mjs`) and `npm run cli`.
- `yaml` dependency (prebuilt, no install hooks).

### Changed
- `run.ts` and the CLI share the built-in sample documents via `src/sample-doc.ts`.

## [0.2.0] — 2026-06-19

### Added
- Reliability layer for probabilistic skills — confidence routing: `≥0.85` proceed, `0.65–0.85` proceed + flag, `<0.65` retry (#1).
- Retry-with-negative-context (budget 2): a failing probabilistic skill is re-invoked with its prior output + the failure reason, and halts with full diagnostics when the budget is exhausted (#1).
- Boundary judge auto-inserted at probabilistic boundaries — no manual judge step (#1).
- `golden_anchors` declared in the probabilistic skill contract and threaded into the judge (#1).
- `extract-highlights` probabilistic skill that exercises the reliability layer end to end (#1).
- `npm test` — `node:test` suite (9 tests): confidence bands, retry-improves-output for both confidence- and judge-triggered failures, deterministic zero-overhead, and the judge catching ungrounded output (#1).
- `--inject lowconf` and `--inject persistent` reliability demo modes (#1).
- Documentation site (VitePress) under `docs-vp/`, plus `version.json`, `src/version.ts` (single version source), and `scripts/sync-versions.mjs` release tooling.
- Community files: `CONTRIBUTING.md`, `CONTRIBUTORS.md`, `SECURITY.md`.
- Reliability benchmark harness (`npm run bench`) — measures judge catch rate, retry recovery, and attempt counts from real traces; writes results to `version.json`.
- Architecture diagram (`docs/architecture.svg`) embedded in the README and docs.
- GitHub Pages deploy workflow for the docs site (`.github/workflows/docs.yml`).

### Changed
- Execution summary and NDJSON trace now record attempt count and confidence band (#1).
- Pipeline renamed `document-grounding-prototype` → `document-grounding`; contract bumped to `0.2.0` (#1).
- `parse-input` no longer performs failure injection — `extract-highlights` owns all `--inject` modes.

### Removed
- Standalone `boundary-judge` pipeline step — superseded by the auto-inserted judge (#1).

## [0.1.0] — 2026-06-19

### Added
- Prototype chain mapping SigMap's ask → validate → judge → learn pattern onto documents: `parse-input → validate-coverage → boundary-judge → memory-update`.
- Core primitives: SKILL, PIPELINE, STATE, ASSERTION.
- Frozen base skills: `base-io` (STATE + checkpoints), `base-assert` (halt-on-failure), `base-log` (NDJSON trace + execution summary).
- Multi-LLM boundary judge: Anthropic (`claude-opus-4-8`), Google AI Studio (`gemini-2.5-flash`), OpenAI (`gpt-4o-mini`), with a deterministic offline heuristic fallback.
- NDJSON trace (SigMap `usage.ndjson`-compatible) + per-skill STATE checkpoints.
- Deterministic failure-injection demos (`--inject coverage`, `--inject hallucination`).

[Unreleased]: https://github.com/manojmallick/skillweave/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/manojmallick/skillweave/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/manojmallick/skillweave/releases/tag/v0.1.0
