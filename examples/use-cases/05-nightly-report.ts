// USE CASE 5 — A nightly grounded report: scheduled activation, routed signals,
// alert thresholds, and a pipeline diagram. The "production wrapper" a plain
// skill never gives you.
//
// THE TASK: every weekday at 09:00, run the document-grounding chain. Route
// low-confidence warnings to the trace log; page a webhook (think Slack) on
// failure. After the run, check alert thresholds and render the pipeline.
//
// WHY A PLAIN SKILL ISN'T ENOUGH:
//   A skill is just the "what to do" — it has no activation model (when does it
//   run? cron? webhook? human approval?), no event routing (who gets told when
//   confidence dips or it fails?), and no observability (alerts, an A/B compare,
//   a diagram). You'd hand-roll all of that around every skill, every time.
//
// WHAT SKILLWEAVE ADDS:
//   • TRIGGER  — cronMatches / shouldActivate: declarative activation
//   • EVENT    — EventBus with routed subscriptions + custom sinks (webhook)
//   • OBSERVE  — checkAlerts threshold rules · visualise (ASCII/Mermaid)
//
// Run:  npx tsx examples/use-cases/05-nightly-report.ts
process.env.JUDGE_PROVIDER ??= "heuristic";

import {
  checkAlerts,
  cronMatches,
  EventBus,
  getSkill,
  loadPipeline,
  runPipeline,
  shouldActivate,
  visualise,
} from "../../src/index.js";
import type { Pipeline, State } from "../../src/index.js";

// ── TRIGGER — should the nightly job fire right now? ─────────────────────────
const NIGHTLY = "0 9 * * 1-5"; // 09:00, Mon–Fri
const monday0900 = new Date(2026, 0, 5, 9, 0);
const sunday0900 = new Date(2026, 0, 4, 9, 0);
console.log("cron fires Mon 09:00 :", cronMatches(NIGHTLY, monday0900));
console.log("cron fires Sun 09:00 :", cronMatches(NIGHTLY, sunday0900));
const decision = shouldActivate({ type: "cron", cron: NIGHTLY }, { now: monday0900 });
console.log("activate decision    :", decision.activate, `(${decision.reason})`);
if (!decision.activate) process.exit(0);

// ── EVENT — wire routed signals + a custom webhook sink (your Slack/pager). ──
const paged: string[] = [];
const bus = new EventBus(
  [
    { on: "low_confidence_detected", emit: "warning", notify: ["trace-log"], continue: true },
    { on: "skill_failed", emit: "failure", notify: ["trace-log", "webhook"], continue: false },
    { on: "pipeline_succeeded", emit: "info", notify: ["trace-log"], continue: true },
  ],
  { webhook: (e) => paged.push(`[PAGE] ${e.type}: ${e.message}`) },
);

// ── Run the grounded chain (the actual nightly work). ────────────────────────
const DOC = `# Nightly platform report

The retrieval rollout reached 100% of traffic this week. Error rate held steady
at 0.2% and no rollbacks were required across any of the regions.

## Metrics
- p95 latency improved to 180ms
- cache hit rate climbed to 94%
- queue depth stayed under 50 at peak`;

const pipeline: Pipeline = {
  name: "nightly-grounding",
  version: "1.0.0",
  domain: "documents",
  steps: ["parse-input", "validate-coverage", "extract-highlights", "memory-update"].map((n) => getSkill(n)!),
};
const state: State = {
  raw_input: DOC,
  _meta: { pipeline: "nightly-grounding", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};
const outcome = await runPipeline(pipeline, state, "heuristic (offline)", { quiet: true });

// Emit the right signal based on outcome (in a real host the orchestrator emits these).
bus.emit(outcome.status === "success" ? "pipeline_succeeded" : "skill_failed", {
  message: `nightly-grounding ${outcome.status}, judge ${state.judge?.score}`,
});

console.log("\nrun status     :", outcome.status, "| judge:", state.judge?.score);
console.log("trace-log lines:", bus.log.length);
console.log("pages sent     :", paged.length ? paged : "(none — healthy)");

// ── OBSERVE — threshold alerts over the run's metrics. ───────────────────────
const metrics = { pass_rate: outcome.status === "success" ? 1 : 0, avg_score: state.judge?.score ?? 0, runs: 1 };
const alerts = checkAlerts(metrics, [
  { id: "low-pass-rate", metric: "pass_rate", op: "<", threshold: 0.5, severity: "alert" },
  { id: "low-score", metric: "avg_score", op: "<", threshold: 0.6 },
]);
console.log("\nfired alerts   :", alerts.length ? JSON.stringify(alerts) : "(none)");

// ── OBSERVE — render the pipeline contract as a diagram. ─────────────────────
const fromYaml = loadPipeline("pipelines/document-grounding.pipeline.yaml");
console.log("\npipeline diagram:\n" + visualise(fromYaml));
