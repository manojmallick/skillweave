---
title: Skill registry
description: SkillWeave's tiered skill registry (v1.0.0) — a 9-point quality gate, trust tiers, quality-derived reputation, and local-first publish / install.
---

# Skill registry

v1.0.0 is the public launch: a **tiered, quality-gated registry** of published skills. It is
local-first — `publish` / `install` read and write a JSON manifest on disk, with no network
and no telemetry, consistent with SkillWeave's posture. The registry lives in
[`src/catalog/`](https://github.com/manojmallick/skillweave/tree/main/src/catalog), distinct
from the runtime resolver (`src/registry.ts`) and the [schema store](/guide/schemas)
(`schemas/registry/`).

## The 9-point quality gate

`gradeSkill(skill)` scores a [skill contract](/guide/skill-contract) against nine checks and
returns a `QualityReport` (`points` · `max` · `checks` · `tier`):

| # | Check | Passes when |
|---|---|---|
| 1 | name | `name` is kebab-case |
| 2 | does | `does` is a substantive description (≥ 10 chars) |
| 3 | does_not | `does_not` declares explicit exclusions |
| 4 | state scope | `state_read` and `state_write` are declared |
| 5 | capabilities | `capabilities` is declared ([security](/guide/security) scope) |
| 6 | assertions | at least one assertion |
| 7 | schema pin | pins an `input_schema` or `output_schema` |
| 8 | neutral | `does` / `does_not` are [model-neutral](/guide/providers) |
| 9 | classification | probabilistic ⇒ `confidence_threshold` + ≥1 golden anchor; deterministic ⇒ no retry budget |

## Trust tiers

The point total maps to a tier:

| Tier | Points |
|---|---|
| `verified` | 9 / 9 |
| `community` | 6 – 8 |
| `experimental` | 3 – 5 |
| _(rejected)_ | < 3 — publishing is refused |

Each published entry also carries a **reputation** = `round(points / 9 * 100)`. (Reputation
is seeded from the quality score; deriving it from trace/run history is a planned follow-up.)

## Publish / install

The store is `.registry/skills.json` (gitignored, like `traces/` and `.context/`):

```bash
npm run cli -- publish extract-highlights
# ✓ published extract-highlights — verified (9/9 · reputation 100)

npm run cli -- registry            # list the catalog grouped by tier
npm run cli -- install extract-highlights
```

`publishSkill` upserts by name and refuses anything below the experimental floor
(`CatalogError`). The four reference skills grade **9/9 → verified**; `load-context` grades
**8/9 → community** (it pins no schema).

## Programmatic API

The catalog is part of the stable `src/index.ts` surface, so a host can grade and publish
skills in-process:

```ts
import { gradeSkill, publishSkill, installSkill, listRegistry } from "skillweave";

const report = gradeSkill(mySkill);     // { points, max, checks, tier }
if (report.tier) publishSkill(mySkill); // throws CatalogError if rejected
```
