// Loads provider capability profiles from provider-profiles/*.profile.yaml.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { packagePath } from "../pkg-path.js";
import type { ProviderModel } from "./types.js";

const DEFAULT_DIR = process.env.SKILLWEAVE_PROFILES_DIR ?? packagePath("provider-profiles");

export function loadProfile(provider: string, dir: string = DEFAULT_DIR): ProviderModel[] {
  const doc = parse(readFileSync(join(dir, `${provider}.profile.yaml`), "utf8")) as {
    models?: ProviderModel[];
  };
  return doc.models ?? [];
}
