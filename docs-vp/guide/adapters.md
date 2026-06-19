---
title: SigMap adapters
description: SkillWeave wraps SigMap's CONTEXT, COST, and OBSERVE primitives as provider adapters that read local artifacts — wrappers, not rebuilds, with no shell spawn.
---

# SigMap adapters

SigMap already solved CONTEXT, COST, and OBSERVE in production for the code domain.
SkillWeave **wraps** those primitives rather than rebuilding them. Because SkillWeave
writes SigMap `usage.ndjson`-compatible traces, the adapters read **local artifacts**
(the `.context/` directory and the NDJSON metric stream) — there is no shell-out to the
`sigmap` CLI and no SigMap dependency.

The adapters live in [`src/adapters/`](https://github.com/manojmallick/skillweave/tree/main/src/adapters)
and implement three provider interfaces.

## OBSERVE — health

`SigMapObserveAdapter` computes a composite **0–100** health score and a grade on
SigMap's own scale (`A≥90 · B≥75 · C≥60 · D<60`, matched to SigMap's
`src/health/scorer.js`). It aggregates, across recent runs:

| Component | Weight | Meaning |
|-----------|:------:|---------|
| success rate | 0.5 | runs that finished without a halt |
| judge pass rate | 0.3 | judged outputs that passed groundedness |
| low-retry rate | 0.2 | `1 − retries / attempts` |

```bash
npm run cli -- health
# health: A (100/100)
```

The grade also prints as a footer after every run, and folds in SigMap's own
`.context/usage.ndjson` when it is present.

## CONTEXT

`SigMapContextAdapter` loads `.context/query-context.md` — the artifact SigMap's `ask`
command writes — and exposes it (with an approximate token count) for injection into a
pipeline. It is a graceful no-op when the file is absent.

```bash
npm run cli -- sigmap context --query "auth flow"
# source: .context/query-context.md  (~210 tokens)
# # Query context …
```

## COST

`SigMapCostAdapter` mirrors SigMap's model-tier routing and reads per-run cost from the
trace stream:

| Tier | Example tasks |
|------|---------------|
| `fast` | typos, formatting, config, docs |
| `balanced` | features, tests (default) |
| `powerful` | architecture, security, migrations, refactors |

```bash
npm run cli -- sigmap cost --suggest-tool "refactor the auth security model"
# tier: powerful
npm run cli -- sigmap cost
# total cost across traces: $0.0040
```

## Configuration

Adapters resolve their directories from `resolvePaths()`:

| Source | Default | Override |
|--------|---------|----------|
| context dir | `./.context` | `SIGMAP_CONTEXT_DIR` |
| traces dir | `./traces` | constructor `{ tracesDir }` |
| base dir | `.` | `SKILLWEAVE_BASE_DIR` |

## Programmatic use

```ts
import { SigMapObserveAdapter, SigMapCostAdapter } from "./adapters/index.js";

const health = new SigMapObserveAdapter().health();   // { score, grade, components }
const tier = new SigMapCostAdapter().routeModel("add a feature with tests"); // "balanced"
```

## Status

Shipped in v0.4.0: **CONTEXT · COST · OBSERVE**. The TRIGGER, EVENT, and MEMORY adapters
and `skillweave install @sigmap/adapters` are planned for later milestones — see the
[roadmap](/guide/roadmap).
