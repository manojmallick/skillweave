// summarize (probabilistic) — an extractive summary: selects the most salient
// content blocks (verbatim, so the auto-judge sees grounded output) and reports
// a confidence. This is a probabilistic boundary: the orchestrator
// confidence-routes the output, auto-judges its groundedness, and retries it
// with negative context. On a retry it tightens its selection (drops the weakest
// pick) so a low-confidence first attempt recovers.

import type { ContentBlock, DocSummary, RetryContext, Skill, State } from "../types.js";

/** Salience in [0,1] — sentences with numbers and substance score higher. */
function salience(text: string): number {
  let s = 0.55;
  if (/\d/.test(text)) s += 0.35; // figures carry information
  if (text.trim().length > 50) s += 0.1; // substantial, not a fragment
  return Math.min(1, Number(s.toFixed(2)));
}

export const summarize: Skill = {
  name: "summarize",
  execution_class: "probabilistic",
  does: "selects the most salient content blocks as an extractive summary with confidence",
  does_not: "paraphrase, parse input, score groundedness, or persist memory",
  state_read: ["content_blocks"],
  state_write: ["summary"],
  input_schema: "content-block@1.1",
  output_schema: "doc-summary@1.0",
  capabilities: [],
  confidence_threshold: 0.8,
  retries: 2,
  golden_anchors: [
    {
      input: { content_blocks: [{ type: "paragraph", text: "Revenue grew 40% to $2M this quarter." }] },
      output: { summary: { sentences: ["Revenue grew 40% to $2M this quarter."] } },
    },
  ],
  assertions: [
    {
      statement: "the summary has at least one sentence",
      check: (s: State) => ({
        statement: "the summary has at least one sentence",
        ok: (s.summary?.sentences.length ?? 0) > 0,
        detail: `${s.summary?.sentences.length ?? 0} sentence(s)`,
      }),
    },
  ],
  async run(state: State, retry?: RetryContext) {
    const blocks = state.content_blocks ?? [];
    // On a retry the negative context says the previous pick was too loose —
    // take fewer, higher-salience sentences so the weakest pick is dropped.
    const take = retry ? 2 : 3;
    const ranked = [...blocks]
      .sort((a, b) => salience(b.text) - salience(a.text))
      .slice(0, Math.min(take, blocks.length));

    const sentences = ranked.map((b) => b.text);
    const summary: DocSummary = { text: sentences.join(" "), sentences };
    const confidence = ranked.length ? Math.min(...ranked.map((b) => salience(b.text))) : 0;
    const judge_blocks: ContentBlock[] = ranked.map((b) => ({ id: b.id, type: "paragraph", text: b.text }));

    return {
      writes: { summary },
      summary: `summarized to ${sentences.length} sentence(s)`,
      cost: 0,
      confidence,
      judge_blocks,
    };
  },
};
