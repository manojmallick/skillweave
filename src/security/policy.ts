// Permission model — default-deny capability grants and the per-skill check.
// A skill is permitted under a policy iff every capability it declares is both
// in the known vocabulary and granted by the policy.

import type { Skill } from "../types.js";
import {
  KNOWN_CAPABILITIES,
  type Capability,
  type PermissionResult,
  type SecurityPolicy,
} from "./types.js";

/**
 * The runtime baseline. Default-deny: only the capabilities the reference
 * pipeline legitimately needs are granted, and filesystem writes are confined
 * to the two artifact roots (`traces/` checkpoints + `.context/` memory log).
 * `net` and `env:read` are NOT granted — the chain is offline-by-default and
 * the framework, not a skill, owns the boundary judge's provider call.
 */
export const DEFAULT_POLICY: SecurityPolicy = {
  capabilities: ["fs:read", "fs:write"],
  fs_write_roots: ["traces", ".context"],
};

/** Capabilities a skill declares (absent field == pure, no side effects). */
export function declaredCapabilities(skill: Skill): Capability[] {
  return skill.capabilities ?? [];
}

/** Check one skill's declared capabilities against a policy. */
export function checkSkillPermissions(
  skill: Skill,
  policy: SecurityPolicy = DEFAULT_POLICY,
): PermissionResult {
  const declared = declaredCapabilities(skill);
  const granted: Capability[] = [];
  const denied: Capability[] = [];
  const unknown: string[] = [];

  for (const cap of declared) {
    if (!KNOWN_CAPABILITIES.includes(cap)) {
      unknown.push(cap);
    } else if (policy.capabilities.includes(cap)) {
      granted.push(cap);
    } else {
      denied.push(cap);
    }
  }

  return {
    skill: skill.name,
    granted,
    denied,
    unknown,
    ok: denied.length === 0 && unknown.length === 0,
  };
}

/** Audit a set of skills against a policy. */
export function auditSkills(
  skills: Skill[],
  policy: SecurityPolicy = DEFAULT_POLICY,
): PermissionResult[] {
  return skills.map((s) => checkSkillPermissions(s, policy));
}
