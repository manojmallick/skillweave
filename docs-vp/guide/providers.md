---
title: Multi-LLM provider layer
description: SkillWeave runs any skill or the boundary judge on any LLM — a provider-adapter layer with capability profiles, tier-based model selection, primary→fallback execution, and a Neutral Skill Language validator.
---

# Multi-LLM provider layer

A skill or the boundary judge runs on any configured LLM without modification. The
provider layer (v0.5.0) formalises this: an adapter interface, capability profiles,
capability-driven model selection, and primary→fallback execution. It lives in
[`src/providers/`](https://github.com/manojmallick/skillweave/tree/main/src/providers).

## Adapters

Each provider implements `LLMProviderAdapter`:

```ts
interface LLMProviderAdapter {
  name: string;
  models: ProviderModel[];
  available(): boolean;                                  // credentials/runtime configured
  supports(requirements: string[]): boolean;             // some model meets every requirement
  selectModel(tier?, requirements?): ProviderModel | null;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
```

| Adapter | Backend | Notes |
|---------|---------|-------|
| `anthropic` | Claude | adaptive thinking + `output_config` structured output |
| `google` | Gemini (AI Studio) | translates the JSON schema to Gemini's `responseSchema` |
| `openai` | OpenAI | `response_format: json_schema` (strict) |
| `ollama` | local models | `fetch` to `OLLAMA_HOST`; zero cost, full privacy |

`complete()` takes a **model-neutral** request (`prompt`, optional `json_schema`,
`max_tokens`); each adapter translates the schema to its provider's structured-output
mechanism and returns `{ text, model, input_tokens, output_tokens, cost }`.

## Capability profiles

Models and their capabilities are declared in `provider-profiles/*.profile.yaml`:

```yaml
provider: anthropic
models:
  - id: claude-opus-4-8
    tier: powerful
    context_window: 1000000
    supports_structured_output: true
    cost_per_1k_input: 0.005
    cost_per_1k_output: 0.025
```

See the full table with `skillweave providers`.

## Executor — model selection + fallback

An `ExecutorSpec` resolves to an ordered list of provider+model targets:

```yaml
# in a .pipeline.yaml
executor:
  primary: anthropic/claude-opus-4-8
  fallback: [google/gemini-2.5-flash, openai/gpt-4o-mini]
  requires: [structured_output]
```

- A bare provider (`anthropic`) **auto-selects** a model by tier + `requires` (a
  requirement like `structured_output` filters out models — and providers — that can't
  satisfy it).
- `runWithFallback` tries each target in order; **if the primary's `complete()` throws,
  the next target runs.**

## The boundary judge

The judge routes its LLM call through the layer: it builds an ordered target list (the
chosen primary plus any other available providers), runs with fallback, and falls back
to the offline heuristic if every provider fails or none is configured.

Provider selection (first match wins):

| Condition | Provider |
|---|---|
| `JUDGE_PROVIDER=anthropic\|gemini\|openai\|ollama\|heuristic` | explicit override |
| `ANTHROPIC_API_KEY` set | anthropic |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` set | google |
| `OPENAI_API_KEY` set | openai |
| `OLLAMA_HOST` set | ollama |
| none | offline heuristic |

```bash
export GEMINI_API_KEY=...        # from aistudio.google.com → "Get API key"
npm start                        # judge runs on the balanced Gemini model
JUDGE_PROVIDER=openai npm start  # force a provider
```

| Variable | Effect |
|---|---|
| `JUDGE_PROVIDER` | Force a provider (or `heuristic`) |
| `ANTHROPIC_MODEL` / `GEMINI_MODEL` / `OPENAI_MODEL` / `OLLAMA_MODEL` | Override the model id |
| `OLLAMA_HOST` | Ollama endpoint (default `http://localhost:11434`) |

The judge's default model is each provider's **balanced** tier; per-provider env
overrides take precedence.

## The offline heuristic

With no provider configured, the judge scores groundedness by token overlap with a
per-fabrication penalty — keeping the chain (and the reliability demos) fully runnable
offline and deterministic.

## Neutral Skill Language

Because the same skill must run on any provider, skill instructions follow the **Neutral
Skill Language Standard**: clear imperative instructions, structured JSON I/O, explicit
exclusions, and no model-specific syntax. The validator enforces it:

```bash
npm run cli -- neutral docs/my-skill.md
```

It flags model/vendor names, thinking-block / XML-tag syntax, and context-window
assumptions, exiting non-zero on any violation.
