// boundary-judge (tool) — maps to SigMap `judge`.
// A separate, lightweight LLM call that scores output groundedness against the
// input content before the chain proceeds. Asserts judge.score >= threshold.

import { judge, lastJudgeCost } from "../judge.js";
import type { Skill, State } from "../types.js";

const THRESHOLD = 0.8;

export const boundaryJudge: Skill = {
  name: "boundary-judge",
  execution_class: "tool",
  does: "scores how well content blocks are grounded in the raw input",
  does_not: "extract content, mutate blocks, or persist memory",
  state_read: ["raw_input", "content_blocks"],
  state_write: ["judge"],
  confidence_threshold: THRESHOLD,
  assertions: [
    {
      statement: `judge groundedness >= ${THRESHOLD}`,
      check: (s: State) => ({
        statement: `judge groundedness >= ${THRESHOLD}`,
        ok: s.judge?.passed === true,
        detail:
          `score ${s.judge?.score} (threshold ${THRESHOLD})` +
          (s.judge?.failure_reason ? ` — ${s.judge.failure_reason}` : ""),
      }),
    },
  ],
  async run(state: State) {
    const verdict = await judge({
      raw_input: state.raw_input ?? "",
      content_blocks: state.content_blocks ?? [],
      threshold: THRESHOLD,
    });
    return {
      writes: { judge: verdict },
      summary: `groundedness ${verdict.score} via ${verdict.source}`,
      cost: lastJudgeCost,
      confidence: verdict.confidence,
    };
  },
};
