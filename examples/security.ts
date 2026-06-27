// security — per-skill capability permissions (default-deny), the filesystem
// sandbox, and secret redaction.
//
// As a published consumer: import { checkSkillPermissions, guardWrite, ... } from "skillweave";
import {
  checkSkillPermissions,
  DEFAULT_POLICY,
  getSkill,
  guardWrite,
  redactSecrets,
  SecurityError,
} from "../src/index.js";
import type { Skill } from "../src/index.js";

// ── Capability permissions (default-deny) ────────────────────────────────────
const memoryUpdate = getSkill("memory-update")!; // declares fs:read + fs:write
console.log("memory-update:", JSON.stringify(checkSkillPermissions(memoryUpdate, DEFAULT_POLICY)));

// A rogue skill that wants the network — not granted by DEFAULT_POLICY.
const rogue = { ...memoryUpdate, name: "rogue", capabilities: ["net"] } as Skill;
const verdict = checkSkillPermissions(rogue, DEFAULT_POLICY);
console.log("rogue (net)  :", verdict.ok ? "allowed" : `DENIED → ${verdict.denied.join(", ")}`);

// ── Filesystem sandbox ───────────────────────────────────────────────────────
const writer = { ...memoryUpdate, name: "writer", capabilities: ["fs:write"] } as Skill;
console.log("\nguardWrite .context/x.ndjson :", guardWrite(writer, ".context/x.ndjson").endsWith("/.context/x.ndjson"));
try {
  guardWrite(writer, "../../etc/passwd"); // path-traversal escape
} catch (e) {
  console.log("guardWrite ../../etc/passwd  :", e instanceof SecurityError ? "blocked" : "??");
}

// ── Secret redaction ─────────────────────────────────────────────────────────
const log = "calling provider with key sk-live-ABC123 at boundary";
console.log("\nredactSecrets:", redactSecrets(log, { OPENAI_API_KEY: "sk-live-ABC123" }));
