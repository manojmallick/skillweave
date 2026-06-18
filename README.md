# SkillWeave — v0.1.0 Prototype Chain

A runnable proof of the SkillWeave mechanics: a 4-skill chain that maps SigMap's
proven **ask → validate → judge → learn** pattern onto a new domain (documents).

```
parse-input  →  validate-coverage  →  boundary-judge  →  memory-update
(sigmap ask)    (sigmap validate)     (sigmap judge)      (sigmap learn)
```

## What it proves

- STATE passes cleanly between skills (write-scope enforced by `base-io`).
- Deterministic skills carry **zero** judge overhead; the probabilistic boundary
  (`boundary-judge`) is the only LLM call.
- Failures are **caught and surfaced** with full diagnostics — never silent.
- An NDJSON trace (SigMap `usage.ndjson`-compatible) and a STATE checkpoint are
  written after every skill.
- `memory-update` records each run locally and reports score trend over runs.

## Run it

```bash
npm install
npm start                          # happy path on the built-in sample document
npm start -- --doc ./mydoc.md      # run on your own document
npm start -- --inject hallucination  # fabricate an ungrounded block → judge HALTS
npm start -- --inject coverage        # too-thin input → coverage assertion HALTS
```

Run `npm start` twice to see `memory-update` report the score trend across runs.

## The boundary judge (multi-LLM)

`boundary-judge` scores how well the parsed `content_blocks` are *grounded* in the
raw input (did `parse-input` fabricate or drop content?). It is provider-pluggable;
the skill instructions are model-neutral and the same prompt/schema runs on either
provider.

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
  types.ts                 SKILL · PIPELINE · STATE · ASSERTION primitives
  orchestrator.ts          drives the chain; halt-and-expose on failure
  judge.ts                 Claude boundary judge + offline heuristic fallback
  base/
    base-io.ts             STATE writes (scope-enforced) + checkpoints   [frozen]
    base-assert.ts         runs declared assertions; failure halts        [frozen]
    base-log.ts            NDJSON trace + execution summary               [frozen]
  skills/
    parse-input.ts         deterministic — extract content blocks
    validate-coverage.ts   deterministic — assert coverage >= 0.70
    boundary-judge.ts      tool          — groundedness >= 0.80
    memory-update.ts       deterministic — local NDJSON learning log
  run.ts                   entry point, sample docs, CLI + failure injection
pipelines/
  document-grounding-prototype.pipeline.yaml   human-readable contract
```

Artifacts land in `traces/` (NDJSON + per-skill checkpoints) and
`.context/skillweave-memory.ndjson` (the learning log). Both are gitignored.
