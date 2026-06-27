// observe — the local-first observability layer: alert rules, a pipeline
// visualiser, and A/B comparison.
//
// As a published consumer: import { checkAlerts, visualise, abTest } from "skillweave";
import { abTest, checkAlerts, loadPipeline, visualise } from "../src/index.js";

// ── Alerting rules ───────────────────────────────────────────────────────────
const metrics = { pass_rate: 0.42, avg_score: 0.71, runs: 50 };
const fired = checkAlerts(metrics, [
  { id: "low-pass-rate", metric: "pass_rate", op: "<", threshold: 0.5, severity: "alert" },
  { id: "low-score", metric: "avg_score", op: "<", threshold: 0.6 },
  { id: "few-runs", metric: "runs", op: "<", threshold: 10 },
]);
console.log("fired alerts :", JSON.stringify(fired));

// ── Pipeline visualiser ──────────────────────────────────────────────────────
const pipeline = loadPipeline("pipelines/document-grounding.pipeline.yaml");
console.log("\nASCII:\n" + visualise(pipeline));
console.log("\nMermaid:\n" + visualise(pipeline, { format: "mermaid" }));

// ── A/B skill testing ────────────────────────────────────────────────────────
console.log("\nabTest(0.91, 0.87):", JSON.stringify(abTest(0.91, 0.87)));
