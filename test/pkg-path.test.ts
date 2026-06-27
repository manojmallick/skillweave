// Package-path resolution — the bundled data dirs resolve relative to the
// package (so a global install reads its own files, not the consumer's cwd),
// while the env overrides still win.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { test } from "node:test";
import { packagePath } from "../src/pkg-path.js";
import { DEFAULT_REGISTRY_DIR, loadSchema } from "../src/schemas/registry.js";

test("packagePath: returns an absolute path under the package root", () => {
  const p = packagePath("schemas", "registry");
  assert.ok(isAbsolute(p));
  assert.ok(p.endsWith(join("schemas", "registry")));
});

test("DEFAULT_REGISTRY_DIR points at the bundled schema registry", () => {
  assert.ok(isAbsolute(DEFAULT_REGISTRY_DIR));
  assert.ok(existsSync(join(DEFAULT_REGISTRY_DIR, "content-block@1.1.json")));
  // and the default still loads a real schema
  assert.equal(loadSchema("content-block@1.1").$id, "content-block@1.1");
});

test("SKILLWEAVE_SCHEMA_DIR env override still wins", async () => {
  const prev = process.env.SKILLWEAVE_SCHEMA_DIR;
  process.env.SKILLWEAVE_SCHEMA_DIR = "test/fixtures/schemas-breaking";
  try {
    // re-import with a cache-busting query so the module re-reads the env
    const mod = await import("../src/schemas/registry.js?override");
    assert.ok((mod.DEFAULT_REGISTRY_DIR as string).endsWith("schemas-breaking"));
  } finally {
    if (prev === undefined) delete process.env.SKILLWEAVE_SCHEMA_DIR;
    else process.env.SKILLWEAVE_SCHEMA_DIR = prev;
  }
});
