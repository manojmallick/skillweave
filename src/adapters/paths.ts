// Resolves the local directories the SigMap adapters read from.

import { join } from "node:path";

export interface AdapterPaths {
  contextDir: string;
  tracesDir: string;
}

export function resolvePaths(opts: Partial<AdapterPaths> = {}): AdapterPaths {
  const base = process.env.SKILLWEAVE_BASE_DIR ?? ".";
  return {
    contextDir: opts.contextDir ?? process.env.SIGMAP_CONTEXT_DIR ?? join(base, ".context"),
    tracesDir: opts.tracesDir ?? join(base, "traces"),
  };
}
