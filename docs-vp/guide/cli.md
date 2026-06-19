---
title: CLI
description: SkillWeave runtime commands and flags — run the chain, inject failures, run on your own document, and execute the test suite.
---

# CLI

The v0.2.0 runtime is driven through npm scripts. A full `skillweave` CLI (`new`,
`validate`, `run`, `test`, `trace`) is the v0.3.0 target — see the [roadmap](/guide/roadmap).

## Commands

| Command | What it does |
|---------|--------------|
| `npm start` | Run the `document-grounding` chain on the built-in sample document |
| `npm start -- --doc <path>` | Run on your own document file |
| `npm start -- --inject <mode>` | Run a reliability demo (see below) |
| `npm test` | Run the `node:test` suite (9 tests) |
| `npm run typecheck` | `tsc --noEmit` |

> Arguments after `--` are forwarded to the runtime, e.g. `npm start -- --doc README.md`.

## `--doc <path>`

Runs the chain on a document file instead of the built-in sample.

```bash
npm start -- --doc ./notes/quarterly.md
```

## `--inject <mode>`

Drives a deterministic failure path so you can watch the reliability layer respond.

| Mode | Demonstrates |
|------|--------------|
| `lowconf` | Confidence routing retries a low-confidence highlight → recovers |
| `hallucination` | The judge retries an ungrounded highlight → recovers |
| `persistent` | An unrecoverable highlight exhausts the retry budget → HALTS |
| `coverage` | A deterministic coverage assertion HALTS (zero retry overhead) |

```bash
npm start -- --inject hallucination
```

## Provider selection

The boundary judge picks a provider from environment variables — see the
[Multi-LLM judge](/guide/providers) guide:

```bash
ANTHROPIC_API_KEY=... npm start     # or GEMINI_API_KEY / OPENAI_API_KEY
JUDGE_PROVIDER=gemini npm start      # force a provider
```

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
| `0` | Chain completed (`STATUS: SUCCESS`) |
| `1` | Chain halted at a skill (`STATUS: HALTED`) |
| `2` | Bad CLI argument (e.g. unknown `--inject` value) |
