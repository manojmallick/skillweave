// skillweave doctor — a one-command readiness report. A Level 1 user runs this
// and learns, in plain language, that they can run SkillWeave right now (offline,
// no API key required), plus what is configured.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { listRegistry } from "../catalog/index.js";
import { judgeExecutorLabel, selectProvider } from "../judge.js";
import { listSkills } from "../registry.js";

/** Minimum Node major SkillWeave supports. */
const MIN_NODE_MAJOR = 20;

export interface DoctorCheck {
  label: string;
  status: "ok" | "info" | "warn";
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  /** True when nothing blocks a first run (offline heuristic always works). */
  ready: boolean;
}

/** Collect the readiness report. Pure read-only — no files written. */
export function runDoctor(): DoctorReport {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    label: "Node.js",
    status: nodeMajor >= MIN_NODE_MAJOR ? "ok" : "warn",
    detail:
      nodeMajor >= MIN_NODE_MAJOR
        ? `v${process.versions.node}`
        : `v${process.versions.node} — SkillWeave needs Node >= ${MIN_NODE_MAJOR}`,
  });

  const offline = selectProvider() === "heuristic";
  checks.push({
    label: "Judge provider",
    status: "ok",
    detail: offline
      ? "offline heuristic — no API key needed"
      : `${judgeExecutorLabel()} (set JUDGE_PROVIDER to override)`,
  });

  checks.push({
    label: "Skills",
    status: "ok",
    detail: `${listSkills().length} registered`,
  });

  const published = listRegistry().length;
  checks.push({
    label: "Registry",
    status: "info",
    detail: published ? `${published} published` : "none yet — try: skillweave publish <skill>",
  });

  const hasTraces = existsSync("traces");
  checks.push({
    label: "Artifacts",
    status: "info",
    detail: hasTraces ? "traces/ present" : "no runs yet — try: skillweave run",
  });

  return { checks, ready: checks.every((c) => c.status !== "warn") };
}
