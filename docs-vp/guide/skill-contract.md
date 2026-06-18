---
title: Skill contract
description: Every SkillWeave skill is a typed contract — does / does_not, read/write scope, assertions, and (for probabilistic skills) confidence, retries, golden anchors, and judge output.
---

# Skill contract

Every skill implements the `Skill` interface in
[`src/types.ts`](https://github.com/manojmallick/skillweave/blob/main/src/types.ts). The
contract is the unit of trust: it declares exactly what the skill does, what it touches,
and how it is verified.

## Fields

| Field | Required | Purpose |
|------|:---:|---------|
| `name` | ✓ | Unique skill identifier |
| `execution_class` | ✓ | `deterministic` · `probabilistic` · `tool` |
| `does` / `does_not` | ✓ | Plain-language responsibility and explicit exclusions |
| `state_read` | ✓ | STATE fields the skill may read |
| `state_write` | ✓ | STATE fields the skill may write (enforced by `base-io`) |
| `assertions` | ✓ | Semantic checks run by `base-assert` after the skill |
| `confidence_threshold` | — | Judge pass threshold (probabilistic) |
| `retries` | — | Retry budget (probabilistic; default 2). Deterministic skills get 0 |
| `golden_anchors` | — | Worked input/output examples fed to the judge |
| `run(state, retry?)` | ✓ | Executes the skill; `retry` carries negative context |

## A deterministic skill

```ts
export const validateCoverage: Skill = {
  name: "validate-coverage",
  execution_class: "deterministic",
  does: "checks whether content blocks are sufficient context for the task",
  does_not: "extract content, score groundedness, or call an LLM",
  state_read: ["content_blocks"],
  state_write: ["coverage"],
  assertions: [
    {
      statement: "coverage_score >= 0.70",
      check: (s) => ({
        statement: "coverage_score >= 0.70",
        ok: s.coverage?.sufficient === true,
        detail: `score ${s.coverage?.score}`,
      }),
    },
  ],
  async run(state) {
    const coverage = assess(state);
    return { writes: { coverage }, summary: `coverage ${coverage.score}`, cost: 0 };
  },
};
```

Deterministic skills carry **zero reliability overhead** — no judge, no confidence
routing, no retry.

## A probabilistic skill

A probabilistic skill additionally declares `confidence_threshold`, `retries`, and
`golden_anchors`, returns a `confidence` (which drives routing), and may return
`judge_blocks` — the output the orchestrator auto-judges for groundedness:

```ts
export const extractHighlights: Skill = {
  name: "extract-highlights",
  execution_class: "probabilistic",
  does: "selects the most important content blocks as highlights with confidence",
  does_not: "parse input, score groundedness, or persist memory",
  state_read: ["content_blocks"],
  state_write: ["highlights"],
  confidence_threshold: 0.8,
  retries: 2,
  golden_anchors: [{ input: { /* … */ }, output: { /* … */ } }],
  assertions: [/* … */],
  async run(state, retry) {
    // `retry` is undefined on the first attempt; on a re-invocation it carries
    // the previous summary + the failure reason (negative context).
    const highlights = select(state, retry);
    return {
      writes: { highlights },
      summary: `selected ${highlights.length} highlights`,
      cost: 0,
      confidence: Math.min(...highlights.map((h) => h.confidence)),
      judge_blocks: highlights.map((h) => ({ id: h.block_id, type: "paragraph", text: h.text })),
    };
  },
};
```

## Rules

1. **Single responsibility** — one job per skill; everything else goes in `does_not`.
2. **Declare your scope** — only read/write the STATE fields you list. `base-io` enforces it.
3. **Neutral language** — skill instructions must run on any LLM provider; no
   model-specific syntax.
4. **Classify honestly** — mark a skill `probabilistic` only if it makes
   non-deterministic decisions; deterministic skills must stay overhead-free.
