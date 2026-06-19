// sigmap-context.adapter — wraps SigMap's CONTEXT primitive by reading the
// `.context/query-context.md` artifact that `sigmap ask` writes. Graceful no-op
// when the artifact is absent. No shell spawn, no SigMap dependency.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePaths } from "./paths.js";
import type { ContextProvider, SigMapContext } from "./types.js";

const QUERY_CONTEXT = "query-context.md";

export class SigMapContextAdapter implements ContextProvider {
  private readonly contextDir: string;

  constructor(opts: { contextDir?: string } = {}) {
    this.contextDir = resolvePaths(opts).contextDir;
  }

  load(query?: string): SigMapContext {
    const source = join(this.contextDir, QUERY_CONTEXT);
    if (!existsSync(source)) {
      return { present: false, source, query, content: "", approx_tokens: 0 };
    }
    const content = readFileSync(source, "utf8");
    return {
      present: true,
      source,
      query,
      content,
      approx_tokens: Math.ceil(content.length / 4), // rough char/4 estimate
    };
  }
}
