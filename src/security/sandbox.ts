// Filesystem sandbox — confines a skill's writes to its policy's roots.
// `guardWrite` is the effect-site complement to the orchestrator's pre-flight
// permission check: it asserts the skill holds `fs:write` and that the target
// path resolves inside an allowed root, blocking `../` traversal escapes.

import { isAbsolute, relative, resolve } from "node:path";
import type { Skill } from "../types.js";
import { declaredCapabilities, DEFAULT_POLICY } from "./policy.js";
import { SecurityError, type SecurityPolicy } from "./types.js";

/** True when `target` resolves inside `root` (no `..` escape, no sibling prefix). */
function isWithin(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Assert that `skill` may write to `path` under `policy`. Throws SecurityError
 * when the skill lacks `fs:write` or the path escapes every allowed root.
 * Returns the resolved absolute path on success.
 */
export function guardWrite(
  skill: Skill,
  path: string,
  policy: SecurityPolicy = DEFAULT_POLICY,
): string {
  if (!declaredCapabilities(skill).includes("fs:write")) {
    throw new SecurityError(
      `sandbox: skill "${skill.name}" attempted a filesystem write without the "fs:write" capability`,
    );
  }
  const allowed = policy.fs_write_roots.some((root) => isWithin(root, path));
  if (!allowed) {
    throw new SecurityError(
      `sandbox: skill "${skill.name}" attempted to write outside its allowed roots ` +
        `(${policy.fs_write_roots.join(", ")}): ${path}`,
    );
  }
  return resolve(path);
}
