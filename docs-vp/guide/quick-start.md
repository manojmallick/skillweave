---
title: Quick start
description: Install SkillWeave, run the document-grounding chain, and watch the reliability layer recover from injected failures.
---

# Quick start

SkillWeave is a runtime for composing LLM tasks from small, focused, testable
micro-skills. This page gets the reference chain running in under a minute.

## Install

```bash
git clone https://github.com/manojmallick/skillweave
cd skillweave
npm install
```

Requires Node.js 20+. The runtime has three dependencies (the Anthropic, Google, and
OpenAI SDKs), used only by the boundary judge.

## Run the chain

```bash
npm start
```

You'll see an execution summary:

```
SkillWeave — document-grounding v0.2.0
executor: heuristic (no LLM key)
────────────────────────────────────────────────────────────────────────
✓ parse-input       deterministic extracted 4 blocks                     1ms  $0.0000
✓ validate-coverage deterministic coverage 1 (sufficient)                0ms  $0.0000
✓ extract-highlights probabilistic selected 3 highlights                  1ms  $0.0000
  └─ judge: 1.00
✓ memory-update     deterministic 1 records, first run                   0ms  $0.0000
────────────────────────────────────────────────────────────────────────
STATUS: SUCCESS   total: 2ms   cost: $0.0000
trace: ./traces/run-…ndjson
```

With no provider key set, the boundary judge runs a deterministic offline heuristic,
so the whole chain completes with zero network calls.

## Watch the reliability layer

Each `--inject` mode demonstrates one behaviour of the [reliability layer](/guide/reliability):

```bash
npm start -- --inject lowconf        # low-confidence highlight → confidence routing RETRIES → recovers
npm start -- --inject hallucination  # ungrounded highlight → judge RETRIES → recovers
npm start -- --inject persistent     # always ungrounded → retries exhausted → HALTS
npm start -- --inject coverage       # too-thin input → deterministic assertion HALTS
```

## Run on your own document

```bash
npm start -- --doc ./path/to/document.md
```

## Use a real model

Set any one provider key and the judge calls that model with structured output:

```bash
export ANTHROPIC_API_KEY=...   # or GEMINI_API_KEY / GOOGLE_API_KEY / OPENAI_API_KEY
npm start
```

See the [Multi-LLM judge](/guide/providers) guide for the full provider matrix.

## Tests

```bash
npm test          # node:test suite (9 tests)
npm run typecheck # tsc --noEmit
```

## Next

- [Architecture](/guide/architecture) — how the runtime is wired
- [Primitives](/guide/primitives) — SKILL, PIPELINE, STATE, ASSERTION
- [Reliability layer](/guide/reliability) — confidence routing, auto-judge, retry
