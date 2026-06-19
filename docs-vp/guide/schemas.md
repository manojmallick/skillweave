---
title: Schema governance
description: SkillWeave pins skill contracts to a versioned schema registry and enforces an additive-only rule, so a schema change can't silently break consumers.
---

# Schema governance

Skill contracts are pinned to a **versioned schema registry**, and an additive-only rule
plus `skillweave check-schemas` stop a schema change from silently breaking consumers
(v0.6.0). The implementation lives in
[`src/schemas/`](https://github.com/manojmallick/skillweave/tree/main/src/schemas).

## The registry

Schemas live at `schemas/registry/<name>@<version>.json` and are referenced as
`name@version`:

```json
{
  "$id": "content-block@1.1",
  "type": "object",
  "properties": { "id": {"type":"string"}, "type": {"type":"string"}, "text": {"type":"string"}, "lang": {"type":"string"} },
  "required": ["id", "type", "text"],
  "additionalProperties": false
}
```

The loader resolves a ref, lists versions of a name, and lists names:

```ts
import { loadSchema, listVersions, parseRef } from "./schemas/registry.js";

parseRef("content-block@1.1");      // { name, version, major: 1, minor: 1 }
listVersions("content-block");       // ["1.0", "1.1"]
loadSchema("content-block@1.0").$id; // "content-block@1.0"
```

## Skill pins

A skill pins the registry schemas it reads and writes:

```ts
export const validateCoverage: Skill = {
  // …
  input_schema: "content-block@1.1",
  output_schema: "coverage@1.0",
};
```

## Additive vs breaking

`diffSchemas(from, to)` classifies a change:

| Change | Classification |
|--------|----------------|
| new **optional** field | additive — **compatible** |
| removed field | **breaking** |
| retyped field | **breaking** |
| newly **required** field | **breaking** (existing producers don't set it) |

```ts
diffSchemas(loadSchema("content-block@1.0"), loadSchema("content-block@1.1"));
// { added: ["lang"], removed: [], retyped: [], newly_required: [], compatible: true }
```

## The additive-only rule

Within a major version, each consecutive version may only **add** — `1.0 → 1.1` must be
additive. A major bump (`1.x → 2.0`) is allowed to break. Removing or retyping a field, or
making a field required, requires a new major.

## check-schemas

`skillweave check-schemas` runs the gate: every schema parses (with a matching `$id`),
every skill pin resolves, and the additive-only rule holds across each schema's versions.
It prints the additive diffs and exits non-zero on a breaking change within a major — wire
it into CI to catch silent breaks before they ship.

```bash
npm run cli -- check-schemas
#   content-block 1.0→1.1: +lang
# ✓ 6 schemas valid · 5 pins resolve · additive-only holds
```
