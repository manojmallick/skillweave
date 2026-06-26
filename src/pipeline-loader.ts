// Pipeline loader — parses a .pipeline.yaml into a runnable Pipeline, resolving
// each step's `skill` name against the registry and applying per-step overrides.

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { getSkill } from "./registry.js";
import type { EventRoute, EventSubscription, EventType } from "./events/types.js";
import type { TriggerSpec, TriggerType } from "./triggers/types.js";
import type { Pipeline, Skill } from "./types.js";

const TRIGGER_TYPES: TriggerType[] = [
  "manual", "file_watch", "git_hook", "git_diff", "webhook", "cron", "pipeline_completion",
];
const EVENT_TYPES: EventType[] = ["info", "warning", "alert", "failure"];
const EVENT_ROUTES: EventRoute[] = ["trace-log", "webhook", "human"];

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export class PipelineError extends Error {
  constructor(
    readonly path: string,
    readonly issues: ValidationIssue[],
  ) {
    super(
      `invalid pipeline ${path}:\n` +
        issues.map((i) => `  [${i.level}] ${i.message}`).join("\n"),
    );
    this.name = "PipelineError";
  }
}

/** Structural + reference validation of a parsed pipeline document. */
export function validatePipelineDoc(doc: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  if (!doc || typeof doc !== "object") {
    error("pipeline file is empty or not a mapping");
    return issues;
  }
  const d = doc as Record<string, unknown>;

  for (const field of ["name", "version", "domain"]) {
    if (d[field] == null) error(`missing top-level field: ${field}`);
  }

  if (d.executor != null) {
    const ex = d.executor as Record<string, unknown>;
    if (typeof ex !== "object" || typeof ex.primary !== "string") {
      error("executor: must declare a string `primary` provider");
    }
  }

  if (d.trigger != null) {
    const t = d.trigger as Record<string, unknown>;
    if (typeof t !== "object" || !TRIGGER_TYPES.includes(t.type as TriggerType)) {
      error(`trigger: type must be one of ${TRIGGER_TYPES.join(" | ")}`);
    } else if (t.type === "cron" && typeof t.cron !== "string") {
      error("trigger: a cron trigger must declare a `cron` expression");
    }
  }

  if (d.events != null) {
    if (!Array.isArray(d.events)) {
      error("events: must be a list of subscriptions");
    } else {
      d.events.forEach((raw, i) => {
        const e = raw as Record<string, unknown>;
        const where = `events[${i}]`;
        if (typeof e?.on !== "string") error(`${where}: missing 'on'`);
        if (!EVENT_TYPES.includes(e?.emit as EventType)) {
          error(`${where}: 'emit' must be one of ${EVENT_TYPES.join(" | ")}`);
        }
        const notify = e?.notify;
        if (!Array.isArray(notify) || notify.some((r) => !EVENT_ROUTES.includes(r as EventRoute))) {
          error(`${where}: 'notify' must be a list of ${EVENT_ROUTES.join(" | ")}`);
        }
      });
    }
  }

  if (!Array.isArray(d.pipeline) || d.pipeline.length === 0) {
    error("pipeline: must be a non-empty list of steps");
    return issues;
  }

  d.pipeline.forEach((raw, i) => {
    const where = `step ${i + 1}`;
    const step = raw as Record<string, unknown>;
    if (!step || typeof step.skill !== "string") {
      error(`${where}: missing 'skill' name`);
      return;
    }
    const skill = getSkill(step.skill);
    if (!skill) {
      error(`${where}: unknown skill '${step.skill}'`);
      return;
    }
    if (step.execution_class != null && step.execution_class !== skill.execution_class) {
      warn(
        `${where} (${step.skill}): declared execution_class '${step.execution_class}' ` +
          `does not match the skill's '${skill.execution_class}'`,
      );
    }
    if (
      step.confidence_threshold != null &&
      (typeof step.confidence_threshold !== "number" ||
        step.confidence_threshold < 0 ||
        step.confidence_threshold > 1)
    ) {
      error(`${where} (${step.skill}): confidence_threshold must be a number in [0, 1]`);
    }
    if (
      step.retries != null &&
      (!Number.isInteger(step.retries) || (step.retries as number) < 0)
    ) {
      error(`${where} (${step.skill}): retries must be a non-negative integer`);
    }
  });

  return issues;
}

/** Parse a pipeline file into a list of validation issues (no execution). */
export function validatePipelineFile(path: string): ValidationIssue[] {
  let doc: unknown;
  try {
    doc = parse(readFileSync(path, "utf8"));
  } catch (err) {
    return [{ level: "error", message: `YAML parse error: ${(err as Error).message}` }];
  }
  return validatePipelineDoc(doc);
}

/** Load + resolve a pipeline file into a runnable Pipeline. Throws PipelineError. */
export function loadPipeline(path: string): Pipeline {
  const doc = parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const issues = validatePipelineDoc(doc);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) throw new PipelineError(path, errors);

  const steps: Skill[] = (doc.pipeline as Record<string, unknown>[]).map((step) => {
    const base = getSkill(step.skill as string)!;
    const overrides: Partial<Skill> = {};
    if (typeof step.confidence_threshold === "number") {
      overrides.confidence_threshold = step.confidence_threshold;
    }
    if (typeof step.retries === "number") overrides.retries = step.retries;
    // Don't mutate the registered skill — clone only when overriding.
    return Object.keys(overrides).length ? { ...base, ...overrides } : base;
  });

  const ex = doc.executor as Record<string, unknown> | undefined;
  const executor = ex
    ? {
        primary: String(ex.primary),
        fallback: ex.fallback as string | string[] | undefined,
        requires: ex.requires as string[] | undefined,
      }
    : undefined;

  const trigger = doc.trigger ? (doc.trigger as TriggerSpec) : undefined;

  const events: EventSubscription[] | undefined = Array.isArray(doc.events)
    ? (doc.events as Record<string, unknown>[]).map((e) => ({
        on: String(e.on),
        emit: e.emit as EventType,
        notify: e.notify as EventRoute[],
        continue: e.continue !== false, // default true
      }))
    : undefined;

  return {
    name: String(doc.name),
    version: String(doc.version),
    domain: String(doc.domain),
    steps,
    ...(executor ? { executor } : {}),
    ...(trigger ? { trigger } : {}),
    ...(events ? { events } : {}),
  };
}
