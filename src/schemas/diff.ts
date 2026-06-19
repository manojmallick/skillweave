// Schema differ. Classifies a from→to schema change as additive (compatible) or
// breaking. Additive = only new optional fields. Breaking = a removed field, a
// retyped field, or a newly-required field (which breaks existing producers).

import type { Schema } from "./registry.js";

export interface SchemaDiff {
  added: string[]; // new optional fields (safe)
  removed: string[]; // breaking
  retyped: string[]; // breaking
  newly_required: string[]; // breaking
  compatible: boolean;
}

function typeOf(props: Schema["properties"], key: string): string {
  return JSON.stringify(props?.[key]?.type ?? null);
}

export function diffSchemas(from: Schema, to: Schema): SchemaDiff {
  const fromProps = from.properties ?? {};
  const toProps = to.properties ?? {};
  const fromKeys = new Set(Object.keys(fromProps));
  const toKeys = new Set(Object.keys(toProps));
  const fromReq = new Set(from.required ?? []);
  const toReq = new Set(to.required ?? []);

  const added = [...toKeys].filter((k) => !fromKeys.has(k));
  const removed = [...fromKeys].filter((k) => !toKeys.has(k));
  const retyped = [...toKeys].filter((k) => fromKeys.has(k) && typeOf(fromProps, k) !== typeOf(toProps, k));
  // A field is newly required if it is required in `to` but was not required in `from`.
  const newly_required = [...toReq].filter((k) => !fromReq.has(k));

  const compatible = removed.length === 0 && retyped.length === 0 && newly_required.length === 0;
  return { added, removed, retyped, newly_required, compatible };
}

export function summariseDiff(d: SchemaDiff): string {
  const parts: string[] = [];
  if (d.added.length) parts.push(`+${d.added.join(",")}`);
  if (d.removed.length) parts.push(`removed ${d.removed.join(",")}`);
  if (d.retyped.length) parts.push(`retyped ${d.retyped.join(",")}`);
  if (d.newly_required.length) parts.push(`newly-required ${d.newly_required.join(",")}`);
  return parts.join(" · ") || "no changes";
}
