// USE CASE 3 — Secret-safe log handling before anything reaches an LLM.
//
// THE TASK: you want an LLM to summarise production logs, but those logs
// contain API keys and you must (a) stop a skill from doing things it wasn't
// authorized to, (b) keep its file writes inside a sandbox, and (c) strip
// secrets out of anything you log or send upstream.
//
// WHY A PLAIN SKILL ISN'T ENOUGH:
//   A markdown/prompt skill has no notion of *capabilities*. It can't declare
//   "I only need to read files", and nothing enforces it — if the surrounding
//   agent has network + filesystem access, so does the skill. There's no
//   sandbox on its writes and no built-in secret redaction. Least-privilege is
//   on you to remember, every time.
//
// WHAT SKILLWEAVE ADDS:
//   • capabilities + default-deny policy — a skill must DECLARE what it needs;
//     anything undeclared (e.g. `net`) is denied before it runs
//   • guardWrite  — path-traversal-proof filesystem sandbox
//   • redactSecrets — scrub known secret values out of any string
//
// Run:  npx tsx examples/use-cases/03-secret-safe-logs.ts
import {
  checkSkillPermissions,
  DEFAULT_POLICY,
  getSkill,
  guardWrite,
  redactSecrets,
  SecurityError,
} from "../../src/index.js";
import type { Skill } from "../../src/index.js";

// ── 1. Capabilities: a skill gets ONLY what it declares, and only if policy allows.
const logReader = getSkill("memory-update")!; // declares fs:read + fs:write
const ok = checkSkillPermissions(logReader, DEFAULT_POLICY);
console.log("log-reader (fs:read, fs:write):", ok.ok ? "✓ allowed" : `DENIED → ${ok.denied.join(", ")}`);

// The same skill, but now it also wants the network to "phone home" — denied.
const exfiltrator = { ...logReader, name: "exfiltrator", capabilities: ["fs:read", "net"] } as Skill;
const verdict = checkSkillPermissions(exfiltrator, DEFAULT_POLICY);
console.log("exfiltrator (wants net)       :", verdict.ok ? "✓ allowed" : `✗ DENIED → ${verdict.denied.join(", ")}`);

// ── 2. Sandbox: writes are pinned under a safe root; traversal escapes are blocked.
const writer = { ...logReader, name: "writer", capabilities: ["fs:write"] } as Skill;
console.log("\nsandboxed write .context/summary.ndjson:", guardWrite(writer, ".context/summary.ndjson").endsWith("/.context/summary.ndjson") ? "✓ stays inside root" : "??");
try {
  guardWrite(writer, "../../etc/passwd");
  console.log("traversal ../../etc/passwd            : NOT blocked ✗");
} catch (e) {
  console.log("traversal ../../etc/passwd            :", e instanceof SecurityError ? "✓ blocked" : "??");
}

// ── 3. Redaction: scrub secrets before the log line is summarised / shipped.
// redactSecrets matches values of known provider key names (ANTHROPIC_API_KEY,
// OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY) — so the LLM key your skill
// uses never leaks into a summary or trace.
const rawLog = "2026-06-30 ERROR upstream auth failed using key sk-live-ABC123XYZ for tenant acme";
const safe = redactSecrets(rawLog, { OPENAI_API_KEY: "sk-live-ABC123XYZ" });
console.log("\nbefore redaction:", rawLog);
console.log("after  redaction:", safe);
console.log("\n→ Only the redacted line is safe to hand to the summarisation skill or write to a trace.");
