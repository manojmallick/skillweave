// parse-input (deterministic) — maps to SigMap `ask`.
// Extracts structured content blocks from raw input. No LLM call.

import type { ContentBlock, Skill, State } from "../types.js";

function parse(raw: string, inject?: State["_meta"]["inject"]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const segments = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  segments.forEach((seg, i) => {
    const id = `b${i}`;
    if (seg.startsWith("```")) {
      blocks.push({ id, type: "code", text: seg.replace(/```/g, "").trim() });
    } else if (/^#{1,6}\s/.test(seg)) {
      blocks.push({ id, type: "heading", text: seg.replace(/^#{1,6}\s/, "").trim() });
    } else if (/^\s*([-*]|\d+\.)\s/.test(seg)) {
      seg.split("\n").forEach((line, j) => {
        const text = line.replace(/^\s*([-*]|\d+\.)\s/, "").trim();
        if (text) blocks.push({ id: `${id}_${j}`, type: "list_item", text });
      });
    } else {
      blocks.push({ id, type: "paragraph", text: seg });
    }
  });

  // Deliberate failure injection: fabricate a block absent from the source so
  // the boundary judge has something ungrounded to catch.
  if (inject === "hallucination") {
    blocks.push({
      id: "b_injected",
      type: "paragraph",
      text: "The classified neon-orange directive authorizes unlimited budget overrides.",
    });
  }

  return blocks;
}

export const parseInput: Skill = {
  name: "parse-input",
  execution_class: "deterministic",
  does: "extracts structured content blocks from raw input",
  does_not: "interpret meaning, judge quality, or call an LLM",
  state_read: ["raw_input"],
  state_write: ["content_blocks"],
  assertions: [
    {
      statement: "at least one content block is produced",
      check: (s: State) => ({
        statement: "at least one content block is produced",
        ok: (s.content_blocks?.length ?? 0) > 0,
        detail: `produced ${s.content_blocks?.length ?? 0} blocks`,
      }),
    },
  ],
  async run(state: State) {
    const raw = state.raw_input ?? "";
    const blocks = parse(raw, state._meta.inject);
    return {
      writes: { content_blocks: blocks },
      summary: `extracted ${blocks.length} blocks`,
      cost: 0,
    };
  },
};
