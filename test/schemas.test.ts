import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSchemas } from "../src/schemas/check.js";
import { diffSchemas } from "../src/schemas/diff.js";
import { listVersions, loadSchema, parseRef } from "../src/schemas/registry.js";

const BREAKING = "test/fixtures/schemas-breaking";

test("registry: parseRef, listVersions, loadSchema", () => {
  const ref = parseRef("content-block@1.1");
  assert.deepEqual(ref, { name: "content-block", version: "1.1", major: 1, minor: 1 });
  assert.deepEqual(listVersions("content-block"), ["1.0", "1.1"]);
  assert.equal(loadSchema("content-block@1.0").$id, "content-block@1.0");
});

test("diff: a new optional field is additive (compatible)", () => {
  const d = diffSchemas(loadSchema("content-block@1.0"), loadSchema("content-block@1.1"));
  assert.equal(d.compatible, true);
  assert.deepEqual(d.added, ["lang"]);
  assert.deepEqual(d.removed, []);
});

test("diff: a removed field is breaking", () => {
  const d = diffSchemas(
    loadSchema("widget@1.0", BREAKING),
    loadSchema("widget@1.1", BREAKING),
  );
  assert.equal(d.compatible, false);
  assert.deepEqual(d.removed, ["b"]);
});

test("diff: a newly-required field is breaking", () => {
  const from = { $id: "x@1.0", type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a"] };
  const to = { $id: "x@1.1", type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a", "b"] };
  const d = diffSchemas(from, to);
  assert.equal(d.compatible, false);
  assert.deepEqual(d.newly_required, ["b"]);
});

test("check-schemas: the real registry is clean with skill pins", () => {
  const pins = ["content-block@1.1", "coverage@1.0", "highlight@1.0", "judge-verdict@1.0", "memory-summary@1.0"];
  const result = checkSchemas(pins);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(result.schemas >= 6);
});

test("check-schemas: an unresolvable pin is an error", () => {
  const result = checkSchemas(["nonexistent@9.9"]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /nonexistent@9\.9/.test(e)));
});

test("check-schemas: a breaking change within a major fails", () => {
  const result = checkSchemas([], BREAKING);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /breaking change within major/.test(e)));
});
