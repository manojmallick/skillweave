// todo-flagger — flags content blocks containing a TODO / FIXME / XXX marker.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeSkill } from "../src/index.js";
import { todoFlagger } from "../src/skills/todo-flagger.js";
import type { ContentBlock, State } from "../src/types.js";

function stateWith(texts: string[]): State {
  const content_blocks: ContentBlock[] = texts.map((text, i) => ({ id: `b${i}`, type: "paragraph", text }));
  return { content_blocks, _meta: { pipeline: "t", run_id: "t", inject: "none", checkpoints: [] } };
}

test("todo-flagger: flags only blocks with a marker", async () => {
  const r = await todoFlagger.run(
    stateWith(["all good", "TODO: write docs", "FIXME: off by one", "XXX revisit this", "fine"]),
  );
  const flags = r.writes.flags ?? [];
  assert.equal(flags.length, 3);
  assert.deepEqual(flags.map((f) => f.marker), ["TODO", "FIXME", "XXX"]);
  assert.equal(flags[0]?.block_id, "b1");
});

test("todo-flagger: empty result on a clean document (still well-formed)", async () => {
  const r = await todoFlagger.run(stateWith(["nothing to see", "ship it"]));
  assert.deepEqual(r.writes.flags, []);
  assert.match(r.summary, /flagged 0/);
});

test("todo-flagger: does not match substrings (word boundary)", async () => {
  const r = await todoFlagger.run(stateWith(["mastodon TODOLIST notwithstanding"]));
  assert.equal((r.writes.flags ?? []).length, 0); // TODOLIST is not a bare TODO
});

test("todo-flagger: grades 9/9 → verified", () => {
  const report = gradeSkill(todoFlagger);
  assert.equal(report.points, 9);
  assert.equal(report.tier, "verified");
});
