// SkillWeave security model — capability vocabulary and policy types.
// A capability names a side effect a skill may perform. The runtime is
// default-deny: a skill may only do what its declared capabilities allow,
// and only what the active SecurityPolicy grants.

/** A side effect a skill may declare it needs. */
export type Capability = "fs:read" | "fs:write" | "net" | "env:read";

/** The full capability vocabulary, in declaration order. */
export const KNOWN_CAPABILITIES: readonly Capability[] = [
  "fs:read",
  "fs:write",
  "net",
  "env:read",
];

/** The capabilities a policy grants and the roots it confines filesystem writes to. */
export interface SecurityPolicy {
  /** Capabilities granted to skills running under this policy. */
  capabilities: Capability[];
  /** Directory roots a `fs:write` skill may write within (relative to cwd). */
  fs_write_roots: string[];
}

/** Outcome of checking one skill against a policy. */
export interface PermissionResult {
  skill: string;
  /** Declared capabilities the policy grants. */
  granted: Capability[];
  /** Declared capabilities the policy denies. */
  denied: Capability[];
  /** Declared capabilities outside the known vocabulary. */
  unknown: string[];
  /** True when nothing is denied and nothing is unknown. */
  ok: boolean;
}

/** Raised when a skill attempts an effect its capabilities/policy do not permit. */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}
