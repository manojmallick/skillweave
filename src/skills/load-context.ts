// load-context (deterministic) — the SigMap integration entry point.
// Sources the chain's raw_input from SigMap's CONTEXT artifact
// (`.context/query-context.md`, written by `sigmap ask`) via the
// SigMapContextAdapter. Passes through an input that is already present, so a
// programmatic caller (or a test) can inject input without a context file.

import { SigMapContextAdapter } from "../adapters/index.js";
import type { Skill, State } from "../types.js";

export const loadContext: Skill = {
  name: "load-context",
  execution_class: "deterministic",
  does: "sources raw_input from SigMap's CONTEXT artifact when not already provided",
  does_not: "parse content, score groundedness, or call an LLM",
  state_read: ["raw_input"],
  state_write: ["raw_input"],
  capabilities: ["fs:read"],
  assertions: [
    {
      statement: "raw_input is non-empty after loading context",
      check: (s: State) => ({
        statement: "raw_input is non-empty after loading context",
        ok: (s.raw_input?.trim().length ?? 0) > 0,
        detail: `${s.raw_input?.length ?? 0} chars`,
      }),
    },
  ],
  async run(state: State) {
    const existing = state.raw_input?.trim();
    if (existing) {
      return { writes: {}, summary: "input already provided — context skipped", cost: 0 };
    }
    const ctx = new SigMapContextAdapter().load();
    if (!ctx.present) {
      return {
        writes: {},
        summary: `no SigMap context at ${ctx.source}`,
        cost: 0,
      };
    }
    return {
      writes: { raw_input: ctx.content },
      summary: `loaded ${ctx.approx_tokens} tokens from ${ctx.source}`,
      cost: 0,
    };
  },
};
