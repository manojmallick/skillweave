// eval — a behavioral eval harness. Grade a pipeline's *behaviour* (not just its
// contract) over cases × trials, with deterministic + judge graders and a
// pass-rate against a CI threshold — like a test suite for skills.
//
// As a published consumer: import { runEval, ... } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic"; // run fully offline

import {
  expectGrounded,
  expectHaltedAt,
  expectStatus,
  getSkill,
  minJudgeScore,
  runEval,
} from "../src/index.js";
import type { EvalSpec } from "../src/index.js";

const pipeline = {
  name: "grounding",
  version: "1.0.0",
  domain: "documents",
  steps: [getSkill("parse-input")!, getSkill("validate-coverage")!, getSkill("extract-highlights")!],
};

const spec: EvalSpec = {
  name: "grounding-eval",
  pipeline,
  trials: 5,
  threshold: 1.0, // every trial of every case must pass
  cases: [
    {
      name: "grounded report",
      input: `# Q3\n\nThe team shipped the retrieval pipeline this quarter, cutting latency forty percent.\n\n## Highlights\n- hit@5 rose from 14% to 76%`,
      graders: [
        { grader: expectStatus("success"), label: "completes" },
        { grader: expectGrounded(), label: "judge passes" },
        { grader: minJudgeScore(0.8), label: "judge >= 0.8" },
      ],
    },
    {
      name: "too-thin note must halt",
      input: "# Note\nok",
      graders: [{ grader: expectHaltedAt("validate-coverage"), label: "halts on thin input" }],
    },
  ],
};

const report = await runEval(spec);

console.log(`eval: ${report.name} — ${report.trials} trials/case, threshold ${report.threshold}\n`);
for (const c of report.cases) {
  console.log(`  ${c.ok ? "✓" : "✗"} ${c.name.padEnd(26)} pass-rate ${(c.passRate * 100).toFixed(0)}%  avg ${c.avgScore}`);
}
console.log(`\n${report.ok ? "✓ PASS" : "✗ FAIL"} — mean pass-rate ${(report.passRate * 100).toFixed(0)}%`);
