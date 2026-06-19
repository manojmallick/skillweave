---
title: Primitives
description: The SkillWeave primitive set — SKILL, PIPELINE, STATE, ASSERTION, JUDGE — and how they compose into a chain.
---

# Primitives

SkillWeave is built from a small set of declared primitives. Every capability maps to
one of them; if something doesn't fit a primitive, it gets redesigned rather than
bolted on.

## Implemented primitives (v0.2.0)

### SKILL

A single focused unit of work with a declared contract: `name`, `execution_class`
(`deterministic` | `probabilistic` | `tool`), `does` / `does_not`, the STATE fields it
may read and write, and its assertions. See the [skill contract](/guide/skill-contract).

### PIPELINE

An ordered list of skills sharing one STATE object. The reference pipeline is
`document-grounding` (`parse-input → validate-coverage → extract-highlights →
memory-update`). Declared in code today; YAML pipeline loading is the v0.3.0 target.

### STATE

The typed, shared object threaded between skills. Schema-governed, write-scoped by
`base-io`, and checkpointed after every skill. The owning skill is the only writer of
each field.

### ASSERTION

A semantic check at a skill boundary, declared on the skill and executed by
`base-assert` after the skill runs. A failing assertion always halts (deterministic
skills) or triggers a retry (probabilistic skills).

### JUDGE

A separate, lightweight LLM call that scores the groundedness of a probabilistic
skill's output (0.0–1.0) against the input. In v0.2.0 the judge is **auto-inserted** by
the orchestrator at every probabilistic boundary. See [Multi-LLM judge](/guide/providers).

## The reliability additions (v0.2.0)

Confidence routing, retry-with-negative-context, and golden anchors extend the SKILL /
ASSERTION / JUDGE primitives — see the [reliability layer](/guide/reliability).

## On the roadmap

The full framework spec defines further primitives — `TOOL`, `CONTEXT`, `TRIGGER`,
`COST`, `MEMORY`, `EVENT`, `SECURITY`, and the advanced `COMPOSE` / `OBSERVE` — most of
which are wrapped from SigMap rather than built from scratch. See the
[roadmap](/guide/roadmap) for sequencing.

## The pattern

The chain is a generalisation of SigMap's proven code-domain workflow:

| SigMap | SkillWeave skill | Class |
|---|---|---|
| `ask` | parse-input | deterministic |
| `validate` | validate-coverage | deterministic |
| `judge` | boundary judge (auto-inserted) | tool |
| `learn` | memory-update | deterministic |

Same pattern, generalised from code to any domain.
