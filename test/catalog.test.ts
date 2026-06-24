// Skill catalog (v1.0.0) — quality gate, tiers, and local publish/install.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import {
  CatalogError,
  gradeSkill,
  installSkill,
  listRegistry,
  publishSkill,
  tierFor,
} from "../src/index.js";
import { parseInput } from "../src/skills/parse-input.js";
import { loadContext } from "../src/skills/load-context.js";
import type { Skill } from "../src/types.js";

const TMP = ".registry-test";
function clean() {
  rmSync(TMP, { recursive: true, force: true });
  rmSync(".registry", { recursive: true, force: true });
}

// A contract that fails almost every check → below the experimental floor.
const REJECTED = {
  name: "Bad Name",
  execution_class: "probabilistic",
  does: "",
  does_not: "",
  assertions: [],
  async run() {
    return { writes: {}, summary: "", cost: 0 };
  },
} as unknown as Skill;

// 1. quality gate + tiers.
test("gradeSkill: a fully-specified reference skill scores 9/9 → verified", () => {
  const report = gradeSkill(parseInput);
  assert.equal(report.max, 9);
  assert.equal(report.points, 9);
  assert.equal(report.tier, "verified");
});

test("gradeSkill: a skill with no schema pin lands in a lower tier", () => {
  const report = gradeSkill(loadContext); // no input/output schema
  assert.equal(report.points, 8);
  assert.equal(report.tier, "community");
  assert.equal(report.checks.find((c) => c.id === "schema_pin")?.ok, false);
});

test("gradeSkill: a contract failing most checks is rejected (tier null)", () => {
  const report = gradeSkill(REJECTED);
  assert.ok(report.points < 3);
  assert.equal(report.tier, null);
});

test("tierFor: thresholds map points to tiers", () => {
  assert.equal(tierFor(9), "verified");
  assert.equal(tierFor(7), "community");
  assert.equal(tierFor(4), "experimental");
  assert.equal(tierFor(2), null);
});

// 2. publish / install / list round-trip.
test("publishSkill → installSkill round-trip persists an entry", () => {
  clean();
  try {
    const entry = publishSkill(parseInput, { dir: TMP, now: "2026-01-01T00:00:00.000Z" });
    assert.equal(entry.tier, "verified");
    assert.equal(entry.reputation, 100);

    const installed = installSkill("parse-input", { dir: TMP });
    assert.equal(installed?.name, "parse-input");
    assert.equal(installed?.published_at, "2026-01-01T00:00:00.000Z");
    assert.equal(listRegistry({ dir: TMP }).length, 1);
  } finally {
    clean();
  }
});

test("publishSkill: upserts by name (no duplicates)", () => {
  clean();
  try {
    publishSkill(parseInput, { dir: TMP });
    publishSkill(parseInput, { dir: TMP });
    assert.equal(listRegistry({ dir: TMP }).length, 1);
  } finally {
    clean();
  }
});

test("publishSkill: refuses a skill below the experimental floor", () => {
  clean();
  try {
    assert.throws(() => publishSkill(REJECTED, { dir: TMP }), CatalogError);
    assert.equal(listRegistry({ dir: TMP }).length, 0);
  } finally {
    clean();
  }
});

// 3. CLI.
test("cli: publish, registry, install exit codes", async () => {
  clean();
  try {
    assert.equal(await cli(["publish", "parse-input"]), 0);
    assert.equal(await cli(["registry"]), 0);
    assert.equal(await cli(["install", "parse-input"]), 0);
    assert.equal(await cli(["install", "no-such-skill"]), 1);
    assert.equal(await cli(["publish", "no-such-skill"]), 1);
  } finally {
    clean();
  }
});
