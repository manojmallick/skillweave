#!/usr/bin/env node
// Launcher for the skillweave CLI. Registers the tsx loader so the TypeScript
// source runs without a build step, then dispatches to cli().
import { register } from "tsx/esm/api";

register();
const { cli } = await import("../src/cli.js");
process.exit(await cli(process.argv.slice(2)));
