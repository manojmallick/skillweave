---
layout: home
title: SkillWeave — compose LLM tasks from small, testable micro-skills
description: SkillWeave is an open standard and runtime for composing LLM tasks from small, focused, testable micro-skills — with orchestration, schema contracts, multi-LLM support, and semantic verification.
head:
  - - meta
    - property: og:title
      content: "SkillWeave — craft intelligence from small, focused pieces"
  - - meta
    - property: og:description
      content: "Compose LLM tasks from micro-skills. Confidence routing, an auto-inserted boundary judge, and retry-with-negative-context. Runs on Claude, Gemini, or OpenAI."
  - - meta
    - name: keywords
      content: "skillweave, llm orchestration, micro-skills, boundary judge, confidence routing, ai reliability, sigmap"

hero:
  name: SkillWeave
  text: Craft intelligence from small, focused pieces.
  tagline: "An open standard and runtime for composing LLM tasks from small, focused, testable micro-skills. Ask → Validate → Judge → Learn."
  actions:
    - theme: brand
      text: Quick start →
      link: /guide/quick-start
    - theme: alt
      text: Architecture
      link: /guide/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/manojmallick/skillweave

features:
  - icon: 🧩
    title: Micro-skills, not mega-prompts
    details: "LLMs produce better, more reliable output given a narrow, well-defined job. Each skill declares does / does_not, an input/output contract, and its own assertions."
    link: /guide/skill-contract
    linkText: Skill contract →
  - icon: ⚖️
    title: A boundary judge at every probabilistic step
    details: "The orchestrator auto-inserts a groundedness judge after every probabilistic skill — no manual wiring. Deterministic skills carry zero overhead."
    link: /guide/reliability
    linkText: Reliability layer →
  - icon: 🔁
    title: Retry with negative context
    details: "A failing skill is re-invoked with its prior output and the failure reason (budget 2), then halts with full diagnostics if it can't recover."
    link: /guide/reliability
    linkText: How retry works →
  - icon: 🔌
    title: Provider-neutral
    details: "The same skill runs on Claude (claude-opus-4-8), Google AI Studio (gemini-2.5-flash), or OpenAI (gpt-4o-mini) — with a deterministic offline heuristic fallback."
    link: /guide/providers
    linkText: Multi-LLM judge →
  - icon: 📊
    title: Local-first observability
    details: "An NDJSON trace (SigMap usage.ndjson-compatible) and a STATE checkpoint are written after every skill and attempt. Zero telemetry."
    link: /guide/architecture
    linkText: Architecture →
  - icon: 🌱
    title: Built on a proven pattern
    details: "SkillWeave generalises SigMap's production ask → validate → judge → learn workflow from code to any domain."
    link: /guide/primitives
    linkText: Primitives →
---

<div style="max-width:840px;margin:0 auto;padding:24px">

## The chain

The reference pipeline maps SigMap's proven **ask → validate → judge → learn** pattern
onto documents:

```
parse-input  →  validate-coverage  →  extract-highlights  →  memory-update
(sigmap ask)    (sigmap validate)     (probabilistic)         (sigmap learn)
                                      ↑ auto-judged · confidence-routed · retried
```

## 60-second start

```bash
npm install
npm start                            # run the built-in chain (offline heuristic judge)
npm start -- --inject hallucination  # ungrounded → judge RETRIES → recovers
npm test                             # node:test suite (21 tests)
```

Or drive it from the `skillweave` CLI (v0.3.0):

```bash
npm run cli -- run pipelines/document-grounding.pipeline.yaml
npm run cli -- validate pipelines/document-grounding.pipeline.yaml
npm run cli -- list
```

To run the boundary judge on a real model, set one of `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, or `OPENAI_API_KEY` — see the [Multi-LLM judge](/guide/providers) guide.

## Where to go next

- New here: [Quick start](/guide/quick-start) · [Architecture](/guide/architecture)
- The model: [Primitives](/guide/primitives) · [Skill contract](/guide/skill-contract)
- The v0.2.0 headline: [Reliability layer](/guide/reliability)
- Running it: [Multi-LLM judge](/guide/providers) · [CLI](/guide/cli)
- What's next: [Roadmap](/guide/roadmap)

</div>
