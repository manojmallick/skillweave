#!/usr/bin/env node
/**
 * sync-versions.mjs
 *
 * Syncs the SkillWeave version across every version-bearing file:
 *   package.json · package-lock.json · version.json · src/version.ts
 *
 * Usage:
 *   node scripts/sync-versions.mjs 0.3.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/sync-versions.mjs <x.y.z>");
  process.exit(1);
}

function setJsonVersion(relPath, mutate) {
  const abs = join(ROOT, relPath);
  const json = JSON.parse(readFileSync(abs, "utf8"));
  mutate(json);
  writeFileSync(abs, JSON.stringify(json, null, 2) + "\n");
  console.log(`  ✓ ${relPath}`);
}

function replaceOne(relPath, pattern, replacer) {
  const abs = join(ROOT, relPath);
  const src = readFileSync(abs, "utf8");
  if (!pattern.test(src)) {
    console.error(`  ✗ ${relPath} (pattern not found)`);
    process.exit(1);
  }
  writeFileSync(abs, src.replace(pattern, replacer));
  console.log(`  ✓ ${relPath}`);
}

console.log(`Syncing versions to ${version}`);

setJsonVersion("package.json", (j) => {
  j.version = version;
});

setJsonVersion("package-lock.json", (j) => {
  j.version = version;
  if (j.packages && j.packages[""]) j.packages[""].version = version;
});

// version.json — bump the version field only; leave stats/notes untouched.
setJsonVersion("version.json", (j) => {
  j.version = version;
});

replaceOne("src/version.ts", /export const VERSION = "\d+\.\d+\.\d+";/, `export const VERSION = "${version}";`);

console.log("Done.");
