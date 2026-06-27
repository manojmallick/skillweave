// Resolve paths to the package's bundled data dirs (schemas/, provider-profiles/,
// pipelines/). This file sits one level under the package root in BOTH layouts —
// `src/pkg-path.ts` (dev, via tsx) and `dist/pkg-path.js` (published, via node) —
// so the same `..` reaches the package root either way. Lets a globally-installed
// CLI read its data from the install location instead of the consumer's cwd.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Join `parts` onto the package root. */
export function packagePath(...parts: string[]): string {
  return join(PKG_ROOT, ...parts);
}
