// extract-highlights (probabilistic) — selects the most important content blocks
// as highlights, each with a confidence. This is the chain's probabilistic
// boundary: the orchestrator confidence-routes its output, auto-judges its
// groundedness, and retries it with negative context on failure.

import type { ContentBlock, Highlight, RetryContext, Skill, State } from "../types.js";

const BASE_CONFIDENCE = 0.9;
const LOWCONF_CONFIDENCE = 0.6;
const FABRICATED_CONFIDENCE = 0.95; // high on purpose: only the judge catches it

const FABRICATED: Highlight = {
  block_id: "h_fabricated",
  text: "Unlimited budget override authorized for all teams.",
  confidence: FABRICATED_CONFIDENCE,
};

function baseHighlights(blocks: ContentBlock[]): Highlight[] {
  return blocks
    .filter((b) => b.type === "heading" || b.type === "list_item" || /\d/.test(b.text))
    .map((b) => ({ block_id: b.id, text: b.text, confidence: BASE_CONFIDENCE }));
}

export const extractHighlights: Skill = {
  name: "extract-highlights",
  execution_class: "probabilistic",
  does: "selects the most important content blocks as highlights with confidence",
  does_not: "parse input, score groundedness, or persist memory",
  state_read: ["content_blocks"],
  state_write: ["highlights"],
  input_schema: "content-block@1.1",
  output_schema: "highlight@1.0",
  confidence_threshold: 0.8,
  retries: 2,
  golden_anchors: [
    {
      input: { content_blocks: [{ type: "heading", text: "Q3 Results" }] },
      output: { highlights: [{ text: "Q3 Results", confidence: 0.9 }] },
    },
  ],
  assertions: [
    {
      statement: "at least one highlight is selected",
      check: (s: State) => ({
        statement: "at least one highlight is selected",
        ok: (s.highlights?.length ?? 0) > 0,
        detail: `selected ${s.highlights?.length ?? 0} highlights`,
      }),
    },
  ],
  async run(state: State, retry?: RetryContext) {
    const blocks = state.content_blocks ?? [];
    const inject = state._meta.inject;
    const firstAttempt = retry === undefined;

    const highlights = baseHighlights(blocks);

    // Speculative picks are added only on the first attempt; on a retry the
    // negative context tells the skill to drop what the previous attempt got
    // wrong — so the recovering attempt omits them.
    if (inject === "lowconf" && firstAttempt) {
      const para = blocks.find((b) => b.type === "paragraph");
      if (para) {
        highlights.push({ block_id: para.id, text: para.text, confidence: LOWCONF_CONFIDENCE });
      }
    }
    if (inject === "hallucination" && firstAttempt) highlights.push({ ...FABRICATED });
    if (inject === "persistent") highlights.push({ ...FABRICATED }); // never recovers

    const confidence = highlights.length
      ? Math.min(...highlights.map((h) => h.confidence))
      : 0;

    const judge_blocks: ContentBlock[] = highlights.map((h) => ({
      id: h.block_id,
      type: "paragraph",
      text: h.text,
    }));

    return {
      writes: { highlights },
      summary: `selected ${highlights.length} highlights`,
      cost: 0,
      confidence,
      judge_blocks,
    };
  },
};
