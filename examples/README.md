# SkillWeave examples

Runnable, self-contained samples — one per feature area. They run **fully offline** (the
boundary judge falls back to a heuristic, so no API key is needed).

Run any of them with `tsx` (a dev dependency):

```bash
npx tsx examples/run-chain.ts
npx tsx examples/verify.ts
npx tsx examples/compose.ts
npx tsx examples/triggers-and-events.ts
npx tsx examples/memory.ts
npx tsx examples/observe.ts
npx tsx examples/custom-skill.ts
npx tsx examples/todo-flagger.ts
npx tsx examples/security.ts
```

> These import from `../src/index.js` so they run inside this repo with no build step.
> As a **published consumer** you'd write the same code with `import { … } from "skillweave"`
> (after `npm install skillweave`).

| Example | Feature area | Shows |
|---|---|---|
| [run-chain.ts](run-chain.ts) | Runtime + reliability | Drive the document-grounding chain with `runPipeline`; confidence routing · auto-judge · retry |
| [verify.ts](verify.ts) | SigMap integration | `runSigMapVerify` returning a structured `VerifyResult` (grounded vs. halted) |
| [compose.ts](compose.ts) | COMPOSE | `sequential` · `parallel` · `mapPattern` · `reducePattern` · `conditional` · `loop` · `dagLayers` |
| [triggers-and-events.ts](triggers-and-events.ts) | TRIGGER + EVENT | `cronMatches` · `shouldActivate`; an `EventBus` with routed subscriptions + a custom webhook sink |
| [memory.ts](memory.ts) | MEMORY | `MemoryStore` record/recall/stats across sessions · decay · conflict log · `failurePatterns` · `recommend` |
| [observe.ts](observe.ts) | OBSERVE | `checkAlerts` threshold rules · `visualise` (ASCII + Mermaid) · `abTest` |
| [custom-skill.ts](custom-skill.ts) | Skill authoring + registry | Define a skill · `gradeSkill` (quality gate → tier) · run it · `publishSkill` / `installSkill` |
| [todo-flagger.ts](todo-flagger.ts) | Skill authoring (new STATE field) | A registered `todo-flagger` skill — flags TODO/FIXME/XXX blocks; grades 9/9 verified |
| [security.ts](security.ts) | SECURITY | `capabilities` · `checkSkillPermissions` (default-deny) · `guardWrite` sandbox · `redactSecrets` |

Artifacts (traces, the memory log, a demo registry) land in gitignored dirs and are safe to
delete.
