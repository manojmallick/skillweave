# SkillWeave — v0.2.0 Reliability Layer

A runnable proof of the SkillWeave mechanics: a 4-skill chain that maps SigMap's
proven **ask → validate → judge → learn** pattern onto a new domain (documents),
now with systematic non-determinism handling at the probabilistic boundary.

```
parse-input  →  validate-coverage  →  extract-highlights  →  memory-update
(sigmap ask)    (sigmap validate)     (probabilistic)         (sigmap learn)
                                      ↑ auto-judged · confidence-routed · retried
```

## What it proves

- STATE passes cleanly between skills (write-scope enforced by `base-io`).
- **Reliability layer** (v0.2.0) wraps probabilistic skills only:
  - **Confidence routing** — `≥0.85` proceed · `0.65–0.85` proceed + flag · `<0.65` retry.
  - **Auto-judge** — the boundary judge runs automatically after a probabilistic skill.
  - **Retry with negative context** — a failing skill is re-invoked (budget 2) with its
    prior output + the failure reason, then halts with full diagnostics if exhausted.
- Deterministic skills carry **zero** reliability overhead (no judge, no routing, no retry).
- Failures are **caught and surfaced** with full diagnostics — never silent.
- An NDJSON trace (SigMap `usage.ndjson`-compatible) and a STATE checkpoint are
  written after every skill / attempt.
- `memory-update` records each run locally and reports score trend over runs.

## Run it

```bash
npm install
npm start                            # happy path on the built-in sample document
npm start -- --doc ./mydoc.md        # run on your own document

# reliability demos:
npm start -- --inject lowconf        # low-confidence highlight → confidence routing RETRIES → recovers
npm start -- --inject hallucination  # ungrounded highlight → judge RETRIES → recovers
npm start -- --inject persistent     # always-ungrounded → retries exhausted → HALTS
npm start -- --inject coverage       # too-thin input → coverage assertion HALTS (deterministic)
```

Run `npm start` twice to see `memory-update` report the score trend across runs.
Run the tests with `npm test`.

## The boundary judge (multi-LLM)

The boundary judge scores how well a probabilistic skill's output is *grounded* in
the raw input (did it fabricate or drop content?). In v0.2.0 it is **auto-inserted**
by the orchestrator after every probabilistic skill — there is no manual judge step.
It is provider-pluggable; the prompt/schema is model-neutral and runs on any provider.

Provider selection (first match wins):

| Condition | Provider | Model |
|---|---|---|
| `JUDGE_PROVIDER=anthropic\|gemini\|openai\|heuristic` | explicit override | — |
| `ANTHROPIC_API_KEY` set | Anthropic | `claude-opus-4-8` (adaptive thinking) |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` set | Google AI Studio | `gemini-2.5-flash` |
| `OPENAI_API_KEY` set | OpenAI | `gpt-4o-mini` |
| none | heuristic | offline token-overlap + fabrication penalty |

All three LLM providers return `{score, passed, confidence, failure_reason}` via
structured output, with per-skill cost computed from token usage. Any provider
error falls back to the heuristic, so the chain always completes.

```bash
# Google AI Studio (https://aistudio.google.com → "Get API key")
export GEMINI_API_KEY=...                 # or GOOGLE_API_KEY
npm start                                 # judge now runs on gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-pro npm start     # override the model

# Anthropic
export ANTHROPIC_API_KEY=...
npm start                                 # judge runs on claude-opus-4-8

# OpenAI
export OPENAI_API_KEY=...
npm start                                 # judge runs on gpt-4o-mini
OPENAI_MODEL=gpt-4o npm start             # override the model

# Force a provider regardless of which keys are present
JUDGE_PROVIDER=openai npm start
```

## Layout

```
src/
  types.ts                 SKILL · PIPELINE · STATE · ASSERTION + reliability types
  orchestrator.ts          drives the chain; confidence routing + auto-judge + retry
  judge.ts                 multi-LLM boundary judge + offline heuristic fallback
  base/
    base-io.ts             STATE writes (scope-enforced) + checkpoints   [frozen]
    base-assert.ts         runs declared assertions; failure halts        [frozen]
    base-log.ts            NDJSON trace + execution summary               [frozen]
  skills/
    parse-input.ts         deterministic — extract content blocks
    validate-coverage.ts   deterministic — assert coverage >= 0.70
    extract-highlights.ts  probabilistic — select highlights w/ confidence (judged + retried)
    memory-update.ts       deterministic — local NDJSON learning log
  run.ts                   entry point, sample docs, CLI + failure injection
pipelines/
  document-grounding.pipeline.yaml   human-readable contract
test/                      node:test suite (npm test)
```

Artifacts land in `traces/` (NDJSON + per-skill checkpoints) and
`.context/skillweave-memory.ndjson` (the learning log). Both are gitignored.
