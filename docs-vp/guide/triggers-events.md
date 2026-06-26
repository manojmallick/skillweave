---
title: Triggers & events
description: SkillWeave's TRIGGER and EVENT primitives (v1.2.0) — declarative pipeline activation and a typed, routed observability signal model, both local-first.
---

# Triggers & events

v1.2.0 adds the two remaining activation/observability primitives. Both are **local-first**:
triggers resolve and events route entirely in-process. The runtime produces routed event
payloads and an activation decision — actually delivering a webhook or prompting a human is
the host's job, so the offline-by-default, zero-shell posture is preserved.

## TRIGGER — activation

A pipeline declares how it is activated in a `trigger:` block:

```yaml
trigger:
  type: cron
  cron: "0 9 * * 1-5"        # weekdays at 09:00
  condition: brand_approved  # host-evaluated gate
  human_checkpoint:
    reason: "design review"
```

| Type | Activates when |
|---|---|
| `manual` | always (the default) |
| `cron` | `cronMatches(cron, now)` is true |
| `webhook` | an inbound payload's secret matches |
| `pipeline_completion` | an upstream pipeline completed |
| `file_watch` · `git_hook` · `git_diff` | fired by the environment (not resolved in-process) |

`shouldActivate(spec, ctx)` returns `{ activate, reason }`. A declared `condition` (gated on
`ctx.conditionMet`) and a `human_checkpoint` (gated on `ctx.approved`) must both hold before
any type activates.

```ts
import { shouldActivate, cronMatches } from "skillweave";

cronMatches("*/15 * * * *", new Date());          // true on every 15th minute
shouldActivate({ type: "manual" }).activate;       // true
```

`cronMatches` is a pure 5-field matcher (minute · hour · day-of-month · month · day-of-week)
supporting `*`, lists (`a,b`), ranges (`a-b`), and steps (`*/n`).

## EVENT — observability signals

A pipeline subscribes to named occurrences in an `events:` block:

```yaml
events:
  - on: low_confidence_detected
    emit: warning
    notify: [trace-log]
    continue: true
  - on: skill_failed
    emit: failure
    notify: [trace-log, webhook]
    continue: false           # halt
  - on: pipeline_succeeded
    emit: info
    notify: [trace-log]
    continue: true
```

Each subscription declares the occurrence (`on`), the severity to `emit`
(`info` / `warning` / `alert` / `failure`), the routes to `notify`
(`trace-log` / `webhook` / `human`), and whether the pipeline may `continue`.

The orchestrator emits three named occurrences during a run —
`low_confidence_detected`, `skill_failed`, and `pipeline_succeeded` — to an optional
`EventBus`. `emit(name)` fans out to every matching subscription across its routes and
returns `{ routed, stop }`; `stop` is true when a matched subscription declares
`continue: false`.

```ts
import { EventBus, runPipeline } from "skillweave";

const bus = new EventBus(pipeline.events, {
  webhook: (e) => deliver(e),   // host supplies real delivery; default collects in memory
});
await runPipeline(pipeline, state, executor, { events: bus });
bus.log;          // events routed to trace-log
bus.deliveries;   // webhook payloads for the host to send
```

Route handlers are injectable; with none supplied they collect in memory (`bus.log`,
`bus.deliveries`, `bus.prompts`) — so the bus is fully testable with no network.
