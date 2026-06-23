// File-backed skill registry — local-first, no network. Publishing runs the
// quality gate; only skills at or above the experimental floor are admitted.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VERSION } from "../version.js";
import type { Skill } from "../types.js";
import { gradeSkill } from "./quality-gate.js";
import type { RegistryEntry } from "./types.js";

const DEFAULT_DIR = ".registry";
const MANIFEST = "skills.json";

/** Raised when a skill cannot be admitted to the registry. */
export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

export interface CatalogOptions {
  /** Registry directory (default `.registry`). */
  dir?: string;
}

function manifestPath(dir: string): string {
  return join(dir, MANIFEST);
}

/** Read every published entry (empty when the registry does not exist yet). */
export function listRegistry(opts: CatalogOptions = {}): RegistryEntry[] {
  const path = manifestPath(opts.dir ?? DEFAULT_DIR);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as RegistryEntry[];
}

/** Look up one published entry by name (null when absent). */
export function installSkill(name: string, opts: CatalogOptions = {}): RegistryEntry | null {
  return listRegistry(opts).find((e) => e.name === name) ?? null;
}

/** Grade a skill and publish it, upserting by name. Throws when rejected. */
export function publishSkill(
  skill: Skill,
  opts: CatalogOptions & { now?: string } = {},
): RegistryEntry {
  const report = gradeSkill(skill);
  if (report.tier === null) {
    throw new CatalogError(
      `"${skill.name}" scored ${report.points}/${report.max} — below the experimental floor; not published`,
    );
  }

  const entry: RegistryEntry = {
    name: skill.name,
    version: VERSION,
    tier: report.tier,
    points: report.points,
    reputation: Math.round((report.points / report.max) * 100),
    published_at: opts.now ?? new Date().toISOString(),
  };

  const dir = opts.dir ?? DEFAULT_DIR;
  const entries = listRegistry(opts).filter((e) => e.name !== entry.name);
  entries.push(entry);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath(dir), JSON.stringify(entries, null, 2) + "\n");
  return entry;
}
