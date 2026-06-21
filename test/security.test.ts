// Security model (v0.7.0) — per-skill capability permissions + filesystem sandbox.
// JUDGE_PROVIDER=heuristic keeps any orchestrator run offline and deterministic.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { runPipeline } from "../src/orchestrator.js";
import { cli } from "../src/cli.js";
import {
  checkSkillPermissions,
  DEFAULT_POLICY,
  guardWrite,
  redactSecrets,
  SecurityError,
  type SecurityPolicy,
} from "../src/security/index.js";
import type { Pipeline, Skill, State } from "../src/types.js";

let runCounter = 0;
function newState(): State {
  return {
    raw_input: "alpha beta gamma",
    _meta: { pipeline: "sec", run_id: `s-${++runCounter}`, inject: "none", checkpoints: [] },
  };
}

function pipe(skill: Skill): Pipeline {
  return { name: "sec", version: "0", domain: "test", steps: [skill] };
}

function mockSkill(capabilities: Skill["capabilities"]): Skill {
  return {
    name: "mock",
    execution_class: "deterministic",
    does: "",
    does_not: "",
    state_read: [],
    state_write: [],
    capabilities,
    assertions: [],
    async run() {
      return { writes: {}, summary: "ran", cost: 0 };
    },
  };
}

// 1. checkSkillPermissions — grant iff every declared capability is granted.
test("checkSkillPermissions: a pure skill is permitted under any policy", () => {
  const r = checkSkillPermissions(mockSkill([]), { capabilities: [], fs_write_roots: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.denied, []);
});

test("checkSkillPermissions: grants only the capabilities the policy lists", () => {
  const r = checkSkillPermissions(mockSkill(["fs:read", "fs:write"]), DEFAULT_POLICY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.granted, ["fs:read", "fs:write"]);
});

test("checkSkillPermissions: an ungranted capability is denied (default-deny)", () => {
  const r = checkSkillPermissions(mockSkill(["net"]), DEFAULT_POLICY);
  assert.equal(r.ok, false);
  assert.deepEqual(r.denied, ["net"]);
});

test("checkSkillPermissions: an unknown capability is flagged", () => {
  const r = checkSkillPermissions(
    mockSkill(["fs:read", "telepathy"] as Skill["capabilities"]),
    DEFAULT_POLICY,
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknown, ["telepathy"]);
});

// 2. Orchestrator halts an over-privileged skill before it runs.
test("orchestrator: an over-privileged skill is denied and never executes", async () => {
  let ran = false;
  const skill = mockSkill(["net"]);
  skill.run = async () => {
    ran = true;
    return { writes: {}, summary: "ran", cost: 0 };
  };

  const outcome = await runPipeline(pipe(skill), newState(), "heuristic", { quiet: true });

  assert.equal(outcome.status, "halted");
  assert.equal(outcome.haltedAt, "mock");
  assert.equal(ran, false, "denied skill must not run");
});

test("orchestrator: the reference pipeline runs unchanged under the default policy", async () => {
  const { parseInput } = await import("../src/skills/parse-input.js");
  const outcome = await runPipeline(pipe(parseInput), newState(), "heuristic", { quiet: true });
  assert.equal(outcome.status, "success");
});

// 3. guardWrite — capability + write-root containment.
const FS_POLICY: SecurityPolicy = { capabilities: ["fs:write"], fs_write_roots: ["traces", ".context"] };

test("guardWrite: allows a write inside an allowed root", () => {
  const resolved = guardWrite(mockSkill(["fs:write"]), ".context/skillweave-memory.ndjson", FS_POLICY);
  assert.ok(resolved.endsWith("/.context/skillweave-memory.ndjson"));
});

test("guardWrite: rejects a write outside the allowed roots", () => {
  assert.throws(
    () => guardWrite(mockSkill(["fs:write"]), "etc/passwd", FS_POLICY),
    SecurityError,
  );
});

test("guardWrite: rejects a path-traversal escape", () => {
  assert.throws(
    () => guardWrite(mockSkill(["fs:write"]), ".context/../../etc/passwd", FS_POLICY),
    SecurityError,
  );
});

test("guardWrite: rejects a skill lacking the fs:write capability", () => {
  assert.throws(() => guardWrite(mockSkill([]), "traces/x.json", FS_POLICY), SecurityError);
});

// 4. redactSecrets — scrub configured API-key values.
test("redactSecrets: replaces a configured key's value", () => {
  const env = { OPENAI_API_KEY: "sk-secret-123" };
  const out = redactSecrets("error from sk-secret-123 at boundary", env);
  assert.equal(out, "error from «REDACTED:OPENAI_API_KEY» at boundary");
});

test("redactSecrets: leaves text untouched when no key is set", () => {
  assert.equal(redactSecrets("plain text", {}), "plain text");
});

// 5. CLI check-permissions gate.
test("check-permissions: returns 0 for the reference skills under the default policy", async () => {
  assert.equal(await cli(["check-permissions"]), 0);
});
