# Changelog

All notable changes to SkillWeave are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] — 2026-06-27

### Added
- `todo-flagger` skill (#56) — a deterministic, registered skill that flags content blocks containing a `TODO` / `FIXME` / `XXX` marker; grades 9/9 → verified. A complete worked example of authoring a skill, including extending `State` with a new field (`flags` / the `TodoFlag` type) and adding a `todo-flag@1.0` registry schema.
- Eight runnable, offline example scripts under [`examples/`](https://github.com/manojmallick/skillweave/tree/main/examples) (#52) — one per feature area (run-chain · verify · compose · triggers-and-events · memory · observe · custom-skill · security), plus `todo-flagger`.
- An Examples guide page (#54) surfaced in the docs sidebar + top nav and the README.

## [2.0.2] — 2026-06-27

First release **published to npm** (`npm i skillweave`).

### Fixed
- CLI: `run --doc`, `test --input`, and `verify --input` now fail gracefully on a missing or malformed file — a clean error and exit code 2 instead of an uncaught Node stack trace (#49). Verified by running every feature end-to-end.

### Added
- Tag-gated npm publish workflow (`.github/workflows/publish.yml`) — publishes on a `vX.Y.Z` tag push (or manual dispatch), idempotent, with npm provenance.
- README license line.

## [2.0.1] — 2026-06-27

### Changed
- Build: the package is now **npm-publishable** (#43). Added a compiled build (`tsconfig.build.json` → `dist/` with JS + `.d.ts` + sourcemaps; `npm run build`; `prepublishOnly`), dropped `private`, and set `main` / `module` / `types` / `exports` to the compiled `dist/index.js` + `dist/index.d.ts`, with a `files` whitelist (`dist`, `schemas`, `provider-profiles`, `pipelines`) and `engines.node >= 20`.
- Schema-registry and provider-profile data now resolve relative to the package install location (`src/pkg-path.ts`), so a globally-installed CLI reads its own bundled data instead of the consumer's cwd; the `SKILLWEAVE_SCHEMA_DIR` / `SKILLWEAVE_PROFILES_DIR` overrides still take precedence.
- The `skillweave` bin runs the compiled `dist/cli.js` when present and falls back to the tsx source loader in a dev checkout.

## [2.0.0] — 2026-06-27

The roadmap capstone. This release also ships the **MEMORY primitive** from `[1.3.0]` below, which was prepared but never tagged — 2.0.0 carries it to a published release.

### Added
- COMPOSE primitive (#39) under `src/compose/` — all composition patterns as pure async combinators: `sequential` · `parallel` · `mapPattern` · `reducePattern` · `conditional(when, then, else?)` · `loop(body, until, maxIterations)`.
- `dagLayers(nodes)` — DAG resolution: orders `depends_on` into parallelizable layers; throws on a cycle or an unknown dependency.
- OBSERVE primitive (#39) under `src/observe/` — a local-first observability layer:
  - `checkAlerts(metrics, rules)` — threshold alerting rules (`>` `>=` `<` `<=` `==` `!=`) → fired alerts with value + severity, routable through the `EventBus`.
  - `visualise(pipeline, { format })` — an ASCII or Mermaid diagram of a pipeline (trigger → steps + events).
  - `abTest(scoreA, scoreB)` — compare two skill-version judge scores → `{ winner, delta }`.
- CLI: `skillweave visualise <pipeline.yaml> [--mermaid]`.
- `src/index.ts` re-exports the COMPOSE + OBSERVE surface.

### Notes
- Deferred (documented): the hosted observability dashboard and live alert/webhook delivery (network — a host responsibility; alerts route through the `EventBus`), orchestrator-level DAG auto-execution, and published performance benchmarks.

## [1.3.0] — 2026-06-27

### Added
- MEMORY primitive (#36) under `src/memory/` — persistent, adaptive knowledge on `.context/` so pipelines learn from past executions. Local-first, no network.
- `MemoryStore` over `.context/skillweave-memory.ndjson` — `record` / `all` / `recall` / `stats` / `conflicts`, back-compatible with the records the `memory-update` skill already writes (records without a `kind` are read as outcomes).
- Decay model — `isStale(ts, now, maxAgeMs)`; `recall` / `stats` exclude records older than the staleness threshold (default 30 days) unless asked.
- Concurrent-write safety — keyed records are last-write-wins in the derived view; a colliding keyed write is appended to a `.conflicts.ndjson` audit log.
- Cross-session learning — `failurePatterns(records)` groups failures by skill + reason; `recommend(stats)` turns aggregate stats into plain-language suggestions.
- Per-skill memory scope — `Skill` gains `memory_reads` / `memory_writes`; the loader parses a step-level `memory: { reads, writes }`; `MemoryStore.scopedTo(skill)` refuses a write outside the declared keys.
- CLI: `skillweave memory [pipeline]` — reports the score trend, pass rate, failure count, failure patterns, and recommendations.
- `src/index.ts` re-exports the MEMORY surface (`MemoryStore`, `failurePatterns`, `recommend`, `isStale`, and the types).

## [1.2.0] — 2026-06-27

### Added
- TRIGGER + EVENT primitives (#32) — declarative pipeline activation and a typed, routed observability signal model. Local-first: triggers resolve and events route in-process; real webhook/human delivery is the host's responsibility.
- EVENT — typed signals (`info` / `warning` / `alert` / `failure`) and an `EventBus`. Subscriptions are declarative (`{ on, emit, notify, continue }`); `emit(name)` fans out to every subscription matching `on`, routes a `SkillEvent` to each `notify` target (`trace-log` / `webhook` / `human`, via injectable handlers that default to in-memory sinks), and returns `{ routed, stop }` — `stop` is true when a matched subscription declares `continue: false`.
- TRIGGER — `TriggerSpec` (`manual` / `cron` / `webhook` / `pipeline_completion` / `file_watch` / `git_hook` / `git_diff`, plus `condition` and `human_checkpoint`), a pure 5-field `cronMatches` (`*`, lists, ranges, steps), and `shouldActivate(spec, ctx)` resolving activation gated by `condition` and a human-approval checkpoint.
- Pipeline `trigger:` and `events:` blocks — parsed and validated by the loader; `Pipeline` gains `trigger` / `events`. The `document-grounding` pipeline now declares both.
- `src/index.ts` re-exports the surface (`EventBus`, `cronMatches`, `shouldActivate`, and the TRIGGER/EVENT types).

### Changed
- The orchestrator emits named events (`low_confidence_detected` / `skill_failed` / `pipeline_succeeded`) to an optional `EventBus` — additive, with zero overhead when none is supplied.

## [1.1.0] — 2026-06-26

### Added
- Developer experience (#28) — first-run onboarding so a newcomer never has to feel the runtime's depth.
- `skillweave doctor` — a one-command readiness report: Node version, the active judge provider (or "offline heuristic — no API key needed"), registered skill count, and registry/artifacts presence, ending with whether you can run now.
- `runDoctor()` returns the report as a structured `DoctorReport` (re-exported from `src/index.ts`).
- "Did you mean?" suggestions — an unknown command suggests the closest command, and an unknown skill name (in `test` / `publish` / `install`) suggests the closest registered skill; `closest` / `levenshtein` exported for reuse.

### Changed
- CLI usage now leads with `skillweave doctor` and a "New here?" hint.

## [1.0.0] — 2026-06-24

First stable release — the public-launch surface. The `src/index.ts` API is now the supported integration point.

### Added
- Skill registry + public launch (#24) under `src/catalog/` — a tiered, quality-gated, local-first registry of published skills.
- 9-point quality gate — `gradeSkill(skill)` scores a contract on name · `does` · `does_not` · state scope · capabilities · assertions · schema pin · model-neutral language · coherent classification, returning a `QualityReport` with points and tier.
- Trust tiers from the gate — `verified` (9/9) · `community` (6–8) · `experimental` (3–5); below the experimental floor (<3) publishing is refused.
- Quality-derived reputation — each entry stores `reputation = round(points / 9 * 100)`.
- File-backed store at `.registry/skills.json` (gitignored, no network) — `publishSkill` / `installSkill` / `listRegistry`.
- CLI: `skillweave publish <skill>` · `install <skill>` · `registry [list]`.
- `src/index.ts` re-exports the catalog surface (`gradeSkill` / `publishSkill` / `installSkill` / `listRegistry` + types).

## [0.8.0] — 2026-06-22

### Added
- SigMap pipeline integration (#20) — SkillWeave can now be embedded as SigMap's internal execution architecture.
- `load-context` skill (deterministic, `fs:read`) sources `raw_input` from SigMap's CONTEXT artifact (`.context/query-context.md`) via the `SigMapContextAdapter`, passing through input that is already provided.
- `sigmap-verify` pipeline (`pipelines/sigmap-verify.pipeline.yaml`) — `load-context → parse-input → validate-coverage → extract-highlights → memory-update`.
- `runSigMapVerify(opts)` — a programmatic entry that runs the verify pipeline through the orchestrator and returns a structured `VerifyResult` (`status` · `grounded` · `judge_score` · `coverage` · `highlights` · `halted_at?` · `health`), with no shell spawn and no CLI.
- Public API barrel `src/index.ts` re-exporting `runSigMapVerify` / `VerifyResult` / `runPipeline` and the registry, security, and adapter surface.
- CLI: `skillweave verify [--input <file>] [--context <dir>]` — runs the verify pipeline and prints the verdict; exits non-zero on a halt.

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
