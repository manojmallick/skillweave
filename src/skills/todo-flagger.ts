// todo-flagger (deterministic) — flags content blocks that contain a TODO,
// FIXME, or XXX marker. Reads content_blocks, writes the `flags` STATE field.
// Pure: no LLM call, no side effects.

import type { Skill, State, TodoFlag } from "../types.js";

const MARKER = /\b(TODO|FIXME|XXX)\b/;

export const todoFlagger: Skill = {
  name: "todo-flagger",
  execution_class: "deterministic",
  does: "flags content blocks that contain a TODO, FIXME, or XXX marker",
  does_not: "parse raw text, judge quality, edit content, or call an LLM",
  state_read: ["content_blocks"],
  state_write: ["flags"],
  input_schema: "content-block@1.1",
  output_schema: "todo-flag@1.0",
  capabilities: [],
  assertions: [
    {
      statement: "flags is a well-formed array",
      check: (s: State) => ({
        statement: "flags is a well-formed array",
        ok: Array.isArray(s.flags),
        detail: `${s.flags?.length ?? 0} flag(s)`,
      }),
    },
  ],
  async run(state: State) {
    const flags: TodoFlag[] = [];
    for (const block of state.content_blocks ?? []) {
      const match = block.text.match(MARKER);
      if (match) {
        flags.push({ block_id: block.id, marker: match[1] as TodoFlag["marker"], text: block.text });
      }
    }
    return { writes: { flags }, summary: `flagged ${flags.length} block(s)`, cost: 0 };
  },
};
