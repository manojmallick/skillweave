// OBSERVE — pipeline visualiser. Render a loaded Pipeline as a text diagram
// (ASCII flow or Mermaid flowchart). Pure: reads the declaration only.

import type { Pipeline } from "../types.js";

export type VisualiseFormat = "ascii" | "mermaid";

/** Render `pipeline` as an ASCII flow or a Mermaid flowchart. */
export function visualise(pipeline: Pipeline, opts: { format?: VisualiseFormat } = {}): string {
  const names = pipeline.steps.map((s) => s.name);
  if (opts.format === "mermaid") return mermaid(pipeline, names);
  return ascii(pipeline, names);
}

function ascii(pipeline: Pipeline, names: string[]): string {
  const lines: string[] = [`${pipeline.name} v${pipeline.version}  (${pipeline.domain})`];
  if (pipeline.trigger) lines.push(`trigger: ${pipeline.trigger.type}`);
  lines.push(names.length ? names.join("  →  ") : "(no steps)");
  if (pipeline.events?.length) {
    lines.push("events:");
    for (const e of pipeline.events) {
      lines.push(`  ${e.on} → ${e.emit} [${e.notify.join(", ")}]${e.continue ? "" : " (halt)"}`);
    }
  }
  return lines.join("\n");
}

function mermaid(pipeline: Pipeline, names: string[]): string {
  const id = (n: string) => n.replace(/[^a-zA-Z0-9_]/g, "_");
  const lines: string[] = ["flowchart TD"];
  if (pipeline.trigger) {
    lines.push(`  trigger[["${pipeline.trigger.type}"]]`);
    if (names[0]) lines.push(`  trigger --> ${id(names[0]!)}`);
  }
  for (const n of names) lines.push(`  ${id(n)}["${n}"]`);
  for (let i = 1; i < names.length; i++) lines.push(`  ${id(names[i - 1]!)} --> ${id(names[i]!)}`);
  return lines.join("\n");
}
