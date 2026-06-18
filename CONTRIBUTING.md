# Contributing to SkillWeave

Thanks for your interest. SkillWeave is an open standard and runtime for composing
LLM tasks from small, focused, testable micro-skills.

## Development setup

```bash
git clone https://github.com/manojmallick/skillweave
cd skillweave
npm install
npm test          # node:test suite
npm run typecheck # tsc --noEmit
npm start         # run the document-grounding chain
```

## Branch & PR flow

- `main` — released code.
- Feature branches: `feat/<short-summary>-<issue>` cut from `main`.
- Open a PR into `main`; CI must be green (typecheck + tests).
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, etc.

## Development principles (from the framework spec)

1. **Primitives over features** — every capability maps to a declared primitive.
2. **Base skills are frozen** — no domain logic in `base-io` / `base-assert` / `base-log`.
3. **Composition over inheritance** — skills declare what they *use*, not what they extend.
4. **Classify before mitigating** — deterministic skills get zero reliability overhead.
5. **Neutral skill language** — skill instructions must run on any LLM provider.
6. **Transparency on failure** — errors always expose which skill, step, input, and cost.

## Adding a skill

A skill implements the `Skill` contract in [`src/types.ts`](src/types.ts): `name`,
`execution_class`, `does` / `does_not`, `state_read` / `state_write`, `assertions`,
and a `run(state, retry?)` function. Probabilistic skills also declare
`confidence_threshold`, `retries`, and `golden_anchors`, and may return `judge_blocks`
for the auto-inserted boundary judge. Add a test under `test/`.

## Releasing

Version + changelog are owned by the docs flow, then tagged separately:

```bash
node scripts/sync-versions.mjs <x.y.z>   # sync package.json · package-lock.json · version.json · src/version.ts
# update CHANGELOG.md, then tag + GitHub release
```
