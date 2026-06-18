---
title: Multi-LLM judge
description: The SkillWeave boundary judge is provider-pluggable — Claude, Google AI Studio, or OpenAI — with structured output and a deterministic offline heuristic fallback.
---

# Multi-LLM judge

The boundary judge scores how well a probabilistic skill's output is *grounded* in the
input (did it fabricate or drop content?). It is **provider-pluggable**: the prompt and
schema are model-neutral and the same judge runs on any provider. Implementation lives
in [`src/judge.ts`](https://github.com/manojmallick/skillweave/blob/main/src/judge.ts).

## Provider selection

First match wins:

| Condition | Provider | Default model |
|---|---|---|
| `JUDGE_PROVIDER=anthropic\|gemini\|openai\|heuristic` | explicit override | — |
| `ANTHROPIC_API_KEY` set | Anthropic | `claude-opus-4-8` (adaptive thinking) |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` set | Google AI Studio | `gemini-2.5-flash` |
| `OPENAI_API_KEY` set | OpenAI | `gpt-4o-mini` |
| none | heuristic | offline token-overlap + fabrication penalty |

All three LLM providers return `{ score, passed, confidence, failure_reason }` via
structured output, with per-skill cost computed from token usage. **Any provider error
falls back to the heuristic**, so the chain always completes.

## Usage

```bash
# Google AI Studio — https://aistudio.google.com → "Get API key"
export GEMINI_API_KEY=...                 # or GOOGLE_API_KEY
npm start
GEMINI_MODEL=gemini-2.5-pro npm start     # override the model

# Anthropic
export ANTHROPIC_API_KEY=...
npm start

# OpenAI
export OPENAI_API_KEY=...
npm start
OPENAI_MODEL=gpt-4o npm start             # override the model

# Force a provider regardless of which keys are present
JUDGE_PROVIDER=openai npm start
```

## Environment variables

| Variable | Effect |
|---|---|
| `JUDGE_PROVIDER` | Force `anthropic` · `gemini` · `openai` · `heuristic` |
| `ANTHROPIC_API_KEY` | Selects Anthropic |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Selects Google AI Studio |
| `OPENAI_API_KEY` | Selects OpenAI |
| `GEMINI_MODEL` | Override the Gemini model (default `gemini-2.5-flash`) |
| `OPENAI_MODEL` | Override the OpenAI model (default `gpt-4o-mini`) |

## The offline heuristic

With no key set, the judge scores groundedness by token overlap between each output
block and the source, then applies a per-fabrication penalty so a single ungrounded
block can't be diluted past the threshold by surrounding faithful blocks. This keeps the
chain — and the reliability demos — fully runnable offline and deterministic.

## Neutral skill language

Because the same skill must run on any provider, skill instructions follow the **Neutral
Skill Language Standard**: clear imperative instructions, structured JSON I/O, explicit
exclusions, and no model-specific syntax (no XML tags, thinking blocks, or assumptions
about a context window).
