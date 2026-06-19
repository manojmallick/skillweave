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

## Provider selection

The boundary judge picks a provider from environment variables — see the
[Multi-LLM judge](/guide/providers) guide:

```bash
ANTHROPIC_API_KEY=... npm run cli -- run <pipeline>   # or GEMINI_API_KEY / OPENAI_API_KEY
JUDGE_PROVIDER=gemini npm run cli -- run <pipeline>    # force a provider
```

## Other scripts

| Command | What it does |
|---------|--------------|
| `npm start [-- --doc <path>] [-- --inject <mode>]` | Run the built-in `document-grounding` chain |
| `npm test` | `node:test` suite (21 tests) |
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
