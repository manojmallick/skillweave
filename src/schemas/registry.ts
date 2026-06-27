// Versioned schema registry. Schemas live at schemas/registry/<name>@<version>.json
// and are referenced as `name@version` (e.g. content-block@1.1).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { packagePath } from "../pkg-path.js";

export const DEFAULT_REGISTRY_DIR =
  process.env.SKILLWEAVE_SCHEMA_DIR ?? packagePath("schemas", "registry");

export interface SchemaRef {
  name: string;
  version: string;
  major: number;
  minor: number;
}

export interface Schema {
  $id: string;
  type: string;
  properties?: Record<string, { type: unknown }>;
  required?: string[];
  additionalProperties?: boolean;
}

export function parseRef(ref: string): SchemaRef {
  const at = ref.lastIndexOf("@");
  if (at < 0) throw new Error(`schema ref must be name@version: ${ref}`);
  const name = ref.slice(0, at);
  const version = ref.slice(at + 1);
  const [major, minor] = version.split(".").map((n) => Number(n));
  if (!name || Number.isNaN(major) || Number.isNaN(minor)) {
    throw new Error(`invalid schema ref: ${ref}`);
  }
  return { name, version, major: major!, minor: minor! };
}

export function schemaExists(ref: string, dir = DEFAULT_REGISTRY_DIR): boolean {
  return existsSync(join(dir, `${ref}.json`));
}

export function loadSchema(ref: string, dir = DEFAULT_REGISTRY_DIR): Schema {
  return JSON.parse(readFileSync(join(dir, `${ref}.json`), "utf8")) as Schema;
}

/** All schema refs present in the registry (e.g. ["content-block@1.0", ...]). */
export function listRefs(dir = DEFAULT_REGISTRY_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/** Versions of a schema name, ascending (e.g. content-block → ["1.0","1.1"]). */
export function listVersions(name: string, dir = DEFAULT_REGISTRY_DIR): string[] {
  return listRefs(dir)
    .map(parseRef)
    .filter((r) => r.name === name)
    .sort((a, b) => a.major - b.major || a.minor - b.minor)
    .map((r) => r.version);
}

/** Distinct schema names in the registry. */
export function listNames(dir = DEFAULT_REGISTRY_DIR): string[] {
  return [...new Set(listRefs(dir).map((ref) => parseRef(ref).name))];
}
