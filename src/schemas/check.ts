// check-schemas engine: every registry schema parses, every skill pin resolves,
// and the additive-only rule holds across consecutive versions within each major.

import { diffSchemas, summariseDiff } from "./diff.js";
import {
  DEFAULT_REGISTRY_DIR,
  listNames,
  listRefs,
  loadSchema,
  parseRef,
  schemaExists,
} from "./registry.js";

export interface CheckResult {
  ok: boolean;
  schemas: number;
  errors: string[];
  diffs: string[]; // human-readable additive diffs (info)
}

export function checkSchemas(pins: string[] = [], dir = DEFAULT_REGISTRY_DIR): CheckResult {
  const errors: string[] = [];
  const diffs: string[] = [];

  // 1. every schema parses + carries a matching $id
  const refs = listRefs(dir);
  for (const ref of refs) {
    try {
      const schema = loadSchema(ref, dir);
      if (schema.$id !== ref) errors.push(`${ref}: $id "${schema.$id}" does not match filename`);
      if (!schema.type) errors.push(`${ref}: missing "type"`);
    } catch (err) {
      errors.push(`${ref}: parse error — ${(err as Error).message}`);
    }
  }

  // 2. every skill pin resolves
  for (const pin of pins) {
    if (!schemaExists(pin, dir)) errors.push(`pin "${pin}" does not resolve in the registry`);
  }

  // 3. additive-only across consecutive versions within the same major
  for (const name of listNames(dir)) {
    const versions = refs
      .map(parseRef)
      .filter((r) => r.name === name)
      .sort((a, b) => a.major - b.major || a.minor - b.minor);
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1]!;
      const next = versions[i]!;
      if (prev.major !== next.major) continue; // major bump may break
      const d = diffSchemas(loadSchema(`${name}@${prev.version}`, dir), loadSchema(`${name}@${next.version}`, dir));
      const label = `${name} ${prev.version}→${next.version}: ${summariseDiff(d)}`;
      if (!d.compatible) errors.push(`breaking change within major — ${label}`);
      else diffs.push(label);
    }
  }

  return { ok: errors.length === 0, schemas: refs.length, errors, diffs };
}
