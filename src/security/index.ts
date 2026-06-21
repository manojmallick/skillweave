// SkillWeave security model (v0.7.0) — per-skill capability permissions and
// a filesystem sandbox. Public surface for the orchestrator, skills, and CLI.

export {
  KNOWN_CAPABILITIES,
  SecurityError,
  type Capability,
  type PermissionResult,
  type SecurityPolicy,
} from "./types.js";
export {
  DEFAULT_POLICY,
  auditSkills,
  checkSkillPermissions,
  declaredCapabilities,
} from "./policy.js";
export { guardWrite } from "./sandbox.js";
export { SECRET_ENV_KEYS, redactSecrets } from "./redact.js";
