#!/usr/bin/env node
// Launcher for the skillweave CLI. Uses the compiled build when present (the
// published package ships dist/), and falls back to the tsx source loader in the
// dev checkout (where dist/ may not be built yet).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distCli = join(here, "..", "dist", "cli.js");

let cli;
if (existsSync(distCli)) {
  ({ cli } = await import(pathToFileURL(distCli).href));
} else {
  const { register } = await import("tsx/esm/api");
  register();
  ({ cli } = await import("../src/cli.js"));
}

process.exit(await cli(process.argv.slice(2)));
