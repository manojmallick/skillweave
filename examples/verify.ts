// verify — SkillWeave as SigMap's in-process verify entry. `runSigMapVerify`
// returns a structured VerifyResult; grounded input passes, too-thin input halts.
//
// As a published consumer: import { runSigMapVerify } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic";

import { runSigMapVerify } from "../src/index.js";

const GROUNDED = `# Q3 Results

The platform team shipped the new retrieval pipeline this quarter, cutting latency by forty
percent after moving ranking onto the graph index.

## Highlights
- hit@5 rose from 14% to 76%`;

const THIN = "# Note\nok";

for (const [label, input] of [["grounded", GROUNDED], ["too-thin", THIN]] as const) {
  const r = await runSigMapVerify({ input, quiet: true });
  console.log(`\n[${label}]`);
  console.log("  status    :", r.status);
  console.log("  grounded  :", r.grounded);
  console.log("  coverage  :", r.coverage);
  console.log("  highlights:", r.highlights);
  console.log("  health    :", `${r.health.grade} (${r.health.score}/100)`);
  if (r.halted_at) console.log("  halted at :", r.halted_at);
}
