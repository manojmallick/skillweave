---
title: CLI
description: The skillweave CLI — run and validate pipeline YAML, test a single skill, list skills, inspect traces, and scaffold new skills and pipelines.
---

# CLI

v0.3.0 ships a real `skillweave` CLI that loads a pipeline from YAML, resolves its
skills from the [registry](/guide/primitives), and drives it through the
[orchestrator](/guide/architecture). Run it via the bin or `npm run cli`:

```bash
npm run cli -- <command> [args]   # or: npx skillweave <command> [args]
```

## Commands

| Command | What it does |
|---------|--------------|
| `run <pipeline.yaml> [--doc <path>] [--inject <mode>]` | Load + execute a pipeline |
| `validate <pipeline.yaml>` | Structural + reference check, no execution |
| `test <skill> [--input <state.json>]` | Run a single skill in isolation |
| `list [skills\|pipelines]` | List registered skills (or pipeline files) |
| `trace [last]` | Print the most recent NDJSON trace |
| `new pipeline\|skill <name>` | Scaffold a starter file |
| `health` | Composite 0–100 health score + grade (SigMap OBSERVE adapter) |
| `sigmap context\|cost\|health` | SigMap adapter access (CONTEXT · COST · OBSERVE) |
| `providers` | Provider/model capability table (tier · structured-output · cost) |
| `neutral <file>` | Neutral Skill Language check (exit 1 on model-specific syntax) |
| `check-schemas` | Validate the schema registry + skill pins + additive-only rule |
| `check-permissions` | Audit each skill's capabilities against the security policy |
| `verify [--input <file>] [--context <dir>]` | Run the `sigmap-verify` pipeline and print the verdict |
| `publish <skill>` | Grade a skill and publish it to the registry |
| `install <skill>` | Look up a published skill in the registry |
| `registry [list]` | List published skills grouped by tier |

The `npm start` entrypoint still runs the built-in `document-grounding` chain directly.

## `run`

Loads a pipeline YAML, resolves each step's skill, and executes via the orchestrator.

```bash
npm run cli -- run pipelines/document-grounding.pipeline.yaml
npm run cli -- run pipelines/document-grounding.pipeline.yaml --doc ./notes/q3.md
npm run cli -- run pipelines/document-grounding.pipeline.yaml --inject hallucination
```

| Flag | Effect |
|------|--------|
| `--doc <path>` | Run on a document file instead of the built-in sample |
| `--inject <mode>` | Drive a reliability demo: `lowconf` · `hallucination` · `persistent` · `coverage` |

Exit `0` on `STATUS: SUCCESS`, `1` on `STATUS: HALTED`.

## `validate`

Checks a pipeline YAML without executing it: required top-level fields, a non-empty
step list, every `skill` resolvable in the registry, and `confidence_threshold` /
`retries` in range. A mismatched declared `execution_class` is a warning.

```bash
npm run cli -- validate pipelines/document-grounding.pipeline.yaml
# ✓ pipelines/document-grounding.pipeline.yaml: valid
```

Exits non-zero when there are errors, printing one line per issue.

## `test`

Runs a single skill in isolation — executes `run()` once, applies its STATE writes,
and runs its assertions. Supply input state as JSON with `--input`:

```bash
npm run cli -- test parse-input
npm run cli -- test extract-highlights --input ./fixtures/blocks.json
```

Exit `0` if assertions pass, `1` if any fail.

## `list` / `trace`

```bash
npm run cli -- list             # registered skills (name · class · does)
npm run cli -- list pipelines   # pipeline YAML files
npm run cli -- trace            # the latest run's NDJSON trace, row by row
```

## `new`

Scaffolds a starter file (refuses to overwrite an existing one):

```bash
npm run cli -- new pipeline my-flow   # → pipelines/my-flow.pipeline.yaml
npm run cli -- new skill my-skill     # → src/skills/my-skill.ts (then register it)
```

## Pipeline YAML

`run` and `validate` operate on a `.pipeline.yaml`:

```yaml
name: document-grounding
version: 0.3.0
domain: documents
pipeline:
  - skill: parse-input
    execution_class: deterministic
  - skill: extract-highlights
    execution_class: probabilistic
    confidence_threshold: 0.80   # overrides the skill default for this step
    retries: 2
```

Each `skill` must be registered (see `skillweave list`). Per-step
`confidence_threshold` and `retries` override the skill's defaults **for that step
only** — the registered skill is never mutated.

## `health`

Computes a composite **0–100** health score and grade (SigMap scale: `A≥90 · B≥75 ·
C≥60 · D<60`) from the NDJSON metric stream — success rate, judge-pass rate, and
low-retry rate across recent runs. The grade also prints as a footer after every
`run` / `npm start`.

```bash
npm run cli -- health
# health: A (100/100)
#   runs            : 1
#   success rate    : 100%
#   judge pass rate : 100%
#   low-retry rate  : 100%
```

## `sigmap`

Direct access to the [SigMap adapters](/guide/adapters) — wrappers over SigMap's local
artifacts (no shell spawn).

```bash
npm run cli -- sigmap context --query "auth flow"      # prints .context/query-context.md if present
npm run cli -- sigmap cost --suggest-tool "refactor auth security"   # → tier: powerful
npm run cli -- sigmap cost                              # total cost across traces
npm run cli -- sigmap health                            # alias of `health`
```

## `providers`

Prints the provider/model capability table loaded from `provider-profiles/*.profile.yaml`
(see the [provider layer](/guide/providers)).

```bash
npm run cli -- providers
# anthropic
#   claude-opus-4-8    powerful  structured     $0.005/$0.025 per 1k
#   ...
```

## `neutral`

Checks a file against the **Neutral Skill Language Standard** — skill instructions must
run on any LLM, so they may not name a model/vendor, use thinking-block / XML syntax, or
assume a context-window size. Exits non-zero on violations.

```bash
npm run cli -- neutral docs/my-skill.md
# ✓ docs/my-skill.md: model-neutral
```

## `check-schemas`

Validates the [schema registry](/guide/schemas): every `schemas/registry/<name>@<version>.json`
parses (and its `$id` matches the filename), every skill `input_schema` / `output_schema`
pin resolves, and the **additive-only rule** holds across consecutive versions within each
major. Exits non-zero on a breaking change within a major.

```bash
npm run cli -- check-schemas
#   content-block 1.0→1.1: +lang
# ✓ 6 schemas valid · 5 pins resolve · additive-only holds
```

## `check-permissions`

Audits the [security model](/guide/security): every registered skill's declared
`capabilities` are checked against `DEFAULT_POLICY` (default-deny). A skill that requests
a capability the policy does not grant — or one outside the known vocabulary — fails the
gate. Exits non-zero on any violation.

```bash
npm run cli -- check-permissions
#   load-context         [fs:read]
#   parse-input          [pure]
#   validate-coverage    [pure]
#   extract-highlights   [pure]
#   memory-update        [fs:read, fs:write]
# ✓ 5 skills within policy (granted: fs:read, fs:write)
```

## `verify`

Runs the [`sigmap-verify`](/guide/sigmap-verify) pipeline — SkillWeave's verify flow for
SigMap. With no `--input`, the `load-context` skill sources the input from SigMap's CONTEXT
artifact (`.context/query-context.md`); `--context <dir>` points it at a different context
directory. Prints a structured verdict and exits non-zero on a halt.

```bash
npm run cli -- verify --input ./notes/q3.md
# sigmap-verify: success
#   grounded   : true (judge 1)
#   coverage   : 1
#   highlights : 2
#   health     : C (72/100)
```

| Flag | Effect |
|------|--------|
| `--input <file>` | Verify a file instead of SigMap's CONTEXT artifact |
| `--context <dir>` | Read the CONTEXT artifact from `<dir>` instead of `.context/` |

The same run is available in-process as `runSigMapVerify()` — see the
[SigMap verify](/guide/sigmap-verify) guide.

## `publish` / `install` / `registry`

The [skill registry](/guide/registry) — a tiered, quality-gated, local-first catalog of
published skills. `publish` runs the [9-point quality gate](/guide/registry), assigns a
trust tier (`verified` / `community` / `experimental`), and writes the entry to
`.registry/skills.json`; a skill below the experimental floor is refused. `install` looks an
entry up; `registry` lists the catalog by tier.

```bash
npm run cli -- publish extract-highlights
#   ✓ name is kebab-case
#   ... (9 checks)
# ✓ published extract-highlights — verified (9/9 · reputation 100)

npm run cli -- registry
# verified
#   extract-highlights   9/9   reputation 100

npm run cli -- install extract-highlights
# extract-highlights@1.0.0 — verified (9/9 · reputation 100)
```

`publish` exits `1` when a skill is rejected (below the experimental floor); `install` exits
`1` when the skill is not in the registry. The same surface is available in-process via
`gradeSkill` / `publishSkill` / `installSkill` / `listRegistry` from the package entry.

## Provider selection

The boundary judge picks a provider from environment variables — see the
[provider layer](/guide/providers) guide:

```bash
ANTHROPIC_API_KEY=... npm run cli -- run <pipeline>   # or GEMINI_API_KEY / OPENAI_API_KEY
JUDGE_PROVIDER=gemini npm run cli -- run <pipeline>    # force a provider
```

## Other scripts

| Command | What it does |
|---------|--------------|
| `npm start [-- --doc <path>] [-- --inject <mode>]` | Run the built-in `document-grounding` chain |
| `npm test` | `node:test` suite (71 tests) |
| `npm run bench` | Reliability benchmark (writes metrics to `version.json` with `--save`) |
| `npm run typecheck` | `tsc --noEmit` |

## Artifacts

| Path | Written by | Contents |
|------|-----------|----------|
| `traces/<run-id>.ndjson` | `base-log` | One metric line per attempt (SigMap `usage.ndjson`-compatible) |
| `traces/checkpoints/` | `base-io` | A STATE snapshot after each skill |
| `.context/skillweave-memory.ndjson` | `memory-update` | The local learning log (score trend across runs) |

All three are gitignored.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (chain completed / valid / assertions passed) |
| `1` | Halt, validation errors, or assertion failure |
| `2` | Bad CLI usage (missing/unknown argument) |
