---
title: Examples
description: "Runnable, offline samples — one per SkillWeave feature area. Run them with npx tsx, or copy the patterns into your own project."
---

# Examples

The repo ships eight self-contained sample scripts in
[`examples/`](https://github.com/manojmallick/skillweave/tree/main/examples), one per feature
area. They run **fully offline** — the boundary judge falls back to a heuristic, so no API key
is needed.

```bash
npx tsx examples/run-chain.ts
npx tsx examples/compose.ts
# ...etc
```

| Example | Feature area | Shows |
|---|---|---|
| [run-chain.ts](https://github.com/manojmallick/skillweave/blob/main/examples/run-chain.ts) | Runtime + reliability | `runPipeline` driving the document-grounding chain — confidence routing · auto-judge · retry |
| [verify.ts](https://github.com/manojmallick/skillweave/blob/main/examples/verify.ts) | [SigMap integration](/guide/sigmap-verify) | `runSigMapVerify` → a structured `VerifyResult` (grounded vs. halted) |
| [compose.ts](https://github.com/manojmallick/skillweave/blob/main/examples/compose.ts) | [COMPOSE](/guide/compose) | `sequential` · `parallel` · `mapPattern` · `reducePattern` · `conditional` · `loop` · `dagLayers` |
| [triggers-and-events.ts](https://github.com/manojmallick/skillweave/blob/main/examples/triggers-and-events.ts) | [TRIGGER + EVENT](/guide/triggers-events) | `cronMatches` · `shouldActivate`; an `EventBus` with routed subscriptions + a custom webhook sink |
| [memory.ts](https://github.com/manojmallick/skillweave/blob/main/examples/memory.ts) | [MEMORY](/guide/memory) | `MemoryStore` across sessions · decay · conflict log · `failurePatterns` · `recommend` |
| [observe.ts](https://github.com/manojmallick/skillweave/blob/main/examples/observe.ts) | [OBSERVE](/guide/observe) | `checkAlerts` · `visualise` (ASCII + Mermaid) · `abTest` |
| [custom-skill.ts](https://github.com/manojmallick/skillweave/blob/main/examples/custom-skill.ts) | [Skill authoring](/guide/skill-contract) + [registry](/guide/registry) | author a skill → `gradeSkill` (9/9 → verified) → run → `publishSkill` / `installSkill` |
| [todo-flagger.ts](https://github.com/manojmallick/skillweave/blob/main/examples/todo-flagger.ts) | [Skill authoring](/guide/skill-contract) | the registered `todo-flagger` skill — extends STATE with a `flags` field, grades 9/9 verified |
| [summarize.ts](https://github.com/manojmallick/skillweave/blob/main/examples/summarize.ts) | [Reliability layer](/guide/reliability) | the probabilistic `summarize` skill — confidence routing → auto-judge → retry recovers a low-confidence attempt |
| [eval.ts](https://github.com/manojmallick/skillweave/blob/main/examples/eval.ts) | Behavioral evaluation | a `runEval` harness — grade a pipeline over cases × trials; pass-rate vs. a CI threshold |
| [security.ts](https://github.com/manojmallick/skillweave/blob/main/examples/security.ts) | [SECURITY](/guide/security) | `checkSkillPermissions` (default-deny) · `guardWrite` sandbox · `redactSecrets` |

Each script imports from `../src/index.js` so it runs in the repo with no build step. As a
**published consumer** you'd write the same code against the package entry:

```ts
import { runSigMapVerify, runPipeline, EventBus, MemoryStore, sequential } from "skillweave";
```

See the [CLI guide](/guide/cli) for the command-line equivalents.

## Real-world use cases

[`examples/use-cases/`](https://github.com/manojmallick/skillweave/tree/main/examples/use-cases)
holds larger scenarios that answer *"why not just write a plain skill / prompt?"* — each
shows what the runtime adds around the model. The first five run fully offline; the sixth is a
head-to-head on a real LLM (needs a provider key).

| Scenario | Feature |
|---|---|
| [01-support-triage](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/01-support-triage.ts) | reliability — confidence routing + auto-judge + retry |
| [02-code-review-gate](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/02-code-review-gate.ts) | contracts + hard assertions + memory across runs |
| [03-secret-safe-logs](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/03-secret-safe-logs.ts) | security — capabilities + sandbox + secret redaction |
| [04-batch-digest](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/04-batch-digest.ts) | composition — map · reduce · parallel · DAG |
| [05-nightly-report](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/05-nightly-report.ts) | production wrapper — trigger + events + observability |
| [06-ab-llm](https://github.com/manojmallick/skillweave/blob/main/examples/use-cases/06-ab-llm.ts) | live-LLM A/B — a raw call vs. the SkillWeave-wrapped skill |

```bash
npx tsx examples/use-cases/01-support-triage.ts
npx tsx examples/use-cases/06-ab-llm.ts --hard   # needs ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY
```
