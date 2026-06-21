---
title: Security model
description: SkillWeave's per-skill security model — a capability vocabulary, a default-deny policy, a filesystem sandbox, and secret redaction, enforced before a skill runs.
---

# Security model

SkillWeave already enforces STATE write-scope in `base-io`. The **security model**
(v0.7.0) extends that posture to a skill's *side effects*: a skill may perform only the
filesystem, network, and environment operations its contract declares — and only what the
active policy grants. The model lives under
[`src/security/`](https://github.com/manojmallick/skillweave/tree/main/src/security) and is
**default-deny**.

## Capabilities

A skill declares the side effects it needs in its `capabilities` field. Absent or empty
means **pure** — no side effects.

| Capability | Grants |
|---|---|
| `fs:read` | Reading files from disk |
| `fs:write` | Writing files to disk |
| `net` | Outbound network requests |
| `env:read` | Reading process environment variables |

The four reference skills declare:

| Skill | Capabilities |
|---|---|
| `parse-input` | _(pure)_ |
| `validate-coverage` | _(pure)_ |
| `extract-highlights` | _(pure)_ |
| `memory-update` | `fs:read` · `fs:write` |

## Policy

A `SecurityPolicy` names the capabilities granted to skills and the roots a `fs:write`
skill may write within. `DEFAULT_POLICY` is the runtime baseline:

```ts
export const DEFAULT_POLICY: SecurityPolicy = {
  capabilities: ["fs:read", "fs:write"],
  fs_write_roots: ["traces", ".context"],
};
```

`net` and `env:read` are **not** granted by default — the chain is offline-by-default, and
the framework (not a skill) owns the boundary judge's provider call. Filesystem writes are
confined to the two artifact roots: `traces/` (checkpoints) and `.context/` (the memory log).

## Enforcement

Two checks enforce the model:

1. **Pre-flight permission check.** Before each skill runs, the orchestrator calls
   `checkSkillPermissions(skill, policy)`. A skill that declares a capability the policy
   does not grant — or one outside the known vocabulary — is **halted before it executes**,
   with secret-redacted diagnostics. Pure skills carry zero overhead and the reference
   pipeline runs unchanged.

2. **Filesystem sandbox.** At the write site, `guardWrite(skill, path, policy)` asserts the
   skill holds `fs:write` and that the resolved path stays inside an allowed root — blocking
   `../` traversal escapes. `memory-update` routes its write through it.

```ts
// halted before running — `net` is not in DEFAULT_POLICY
const rogue: Skill = { /* … */ capabilities: ["net"], /* … */ };
// ✗ security: denied capabilities: net
```

## Secret redaction

`redactSecrets(text)` scrubs the values of the provider API-key environment variables
(`ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `GOOGLE_API_KEY` · `OPENAI_API_KEY`) from any
string, replacing each with a `«REDACTED:NAME»` marker. The orchestrator runs every
security diagnostic through it, so a key value can never reach a trace or summary — backing
the guarantee in [`SECURITY.md`](https://github.com/manojmallick/skillweave/blob/main/SECURITY.md).

## Audit from the CLI

`skillweave check-permissions` audits every registered skill against `DEFAULT_POLICY` and
exits non-zero on any violation:

```bash
npm run cli -- check-permissions
#   parse-input          [pure]
#   validate-coverage    [pure]
#   extract-highlights   [pure]
#   memory-update        [fs:read, fs:write]
# ✓ 4 skills within policy (granted: fs:read, fs:write)
```
