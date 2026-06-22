---
title: SigMap verify
description: SkillWeave as SigMap's internal execution architecture — the load-context skill, the sigmap-verify pipeline, and the runSigMapVerify in-process API.
---

# SigMap verify

v0.8.0 lets **SigMap embed SkillWeave as its own execution layer**. SigMap's `ask` writes a
CONTEXT artifact; SkillWeave reads it and runs the `ask → validate → judge → learn` verify
flow — confidence-routed, auto-judged, and retried — returning a structured verdict. No
shell spawn, no CLI: SigMap imports the runtime and calls one function.

## load-context

`load-context` is a deterministic skill (capability `fs:read`) that sources the chain's
`raw_input` from SigMap's CONTEXT artifact ([`SigMapContextAdapter`](/guide/adapters)):

- **No input provided** → reads `.context/query-context.md` (or `SIGMAP_CONTEXT_DIR`).
- **Input already set** → passes through unchanged, so a host or test can inject input
  directly.

It is the first step of the `sigmap-verify` pipeline and the seam between SigMap's CONTEXT
primitive and SkillWeave's runtime.

## The sigmap-verify pipeline

```
load-context → parse-input → validate-coverage → extract-highlights → memory-update
(sigmap CONTEXT)  (ask)          (validate)          (probabilistic)      (learn)
                                                     ↑ auto-judged · confidence-routed · retried
```

Declared in [`pipelines/sigmap-verify.pipeline.yaml`](https://github.com/manojmallick/skillweave/blob/main/pipelines/sigmap-verify.pipeline.yaml)
and runnable from the CLI:

```bash
npm run cli -- verify --input ./notes/q3.md   # or omit --input to read SigMap's CONTEXT
npm run cli -- validate pipelines/sigmap-verify.pipeline.yaml
```

## runSigMapVerify

The in-process entry point. SigMap (or any host) imports it from the public API barrel
`src/index.ts` and runs a verification without a subprocess:

```ts
import { runSigMapVerify } from "skillweave";

const result = await runSigMapVerify({ input });   // omit input to read SigMap's CONTEXT
// → VerifyResult
```

`VerifyResult` is the structured outcome:

| Field | Meaning |
|---|---|
| `status` | `"success"` or `"halted"` |
| `grounded` | chain completed **and** the boundary judge passed |
| `judge_score` | groundedness score (or `null`) |
| `coverage` | coverage score from `validate-coverage` (or `null`) |
| `highlights` | number of highlights selected |
| `halted_at` | the skill a halted run stopped at |
| `health` | composite `{ grade, score }` from the OBSERVE adapter |
| `run_id` | the run identifier (NDJSON trace + checkpoints) |

`VerifyOptions` accepts `input`, `quiet`, and a `policy` override (the
[security model](/guide/security) is enforced per skill — `load-context` runs under its
`fs:read` capability).

## Public API

`src/index.ts` re-exports the integration surface so SigMap depends on SkillWeave as a
library: `runSigMapVerify` · `VerifyResult` · `sigmapVerifyPipeline` · `runPipeline` · the
core types · the registry · the [security](/guide/security) model · the
[SigMap adapters](/guide/adapters).
