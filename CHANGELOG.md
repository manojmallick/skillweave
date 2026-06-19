# Changelog

All notable changes to SkillWeave are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
