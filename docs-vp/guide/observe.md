---
title: Observe
description: "SkillWeave's OBSERVE primitive (v2.0.0) — local-first observability: threshold alerting rules, a pipeline visualiser, and A/B skill testing."
---

# Observe

v2.0.0 adds the **OBSERVE** primitive: a local-first observability layer. It evaluates alert
rules, renders pipelines, and compares skill versions — all in-process, no network. Alerts
route through the v1.2 [`EventBus`](/guide/triggers-events); a host delivers them.

## Alerting rules

`checkAlerts(metrics, rules)` fires the rules whose metric comparison holds, carrying the
observed value and a severity.

```ts
import { checkAlerts } from "skillweave";

checkAlerts({ pass_rate: 0.4 }, [
  { id: "low-pass", metric: "pass_rate", op: "<", threshold: 0.5, severity: "alert" },
]);
// → [{ id: "low-pass", metric: "pass_rate", value: 0.4, op: "<", threshold: 0.5, severity: "alert" }]
```

Operators: `>` · `>=` · `<` · `<=` · `==` · `!=`. Severity defaults to `warning`. A rule whose
metric is absent never fires. Route the fired alerts through an `EventBus` for delivery.

## Pipeline visualiser

`visualise(pipeline, { format })` renders a loaded pipeline as an ASCII flow (default) or a
Mermaid flowchart. The CLI wraps it as [`skillweave visualise`](/guide/cli#visualise).

```ts
import { visualise } from "skillweave";
visualise(pipeline);                      // ASCII: trigger → steps + events
visualise(pipeline, { format: "mermaid" }); // Mermaid flowchart
```

## A/B skill testing

`abTest(scoreA, scoreB)` compares two skill versions by their boundary-judge score — the
higher wins (equal is a tie), with the delta.

```ts
import { abTest } from "skillweave";
abTest(0.91, 0.88);   // { winner: "a", a: 0.91, b: 0.88, delta: 0.03 }
```

## Deferred

The hosted observability dashboard and live alert/webhook delivery are a host responsibility
(network), and orchestrator-level DAG auto-execution and published performance benchmarks are
planned follow-ups — kept out of the runtime to preserve the offline-by-default, zero-shell
posture.
