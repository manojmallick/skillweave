// skillweave CLI — run / validate / test / list / trace / new.
// Exposed as cli(argv) returning an exit code so it is unit-testable.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  SigMapContextAdapter,
  SigMapCostAdapter,
  SigMapObserveAdapter,
} from "./adapters/index.js";
import { checkNeutralLanguage, loadProfile } from "./providers/index.js";
import { checkSchemas } from "./schemas/check.js";
import { AssertionError, runAssertions } from "./base/base-assert.js";
import { applyWrites } from "./base/base-io.js";
import { judgeExecutorLabel } from "./judge.js";
import { runPipeline } from "./orchestrator.js";
import { loadPipeline, PipelineError, validatePipelineFile } from "./pipeline-loader.js";
import { getSkill, listSkills } from "./registry.js";
import { SAMPLE_DOC, THIN_DOC } from "./sample-doc.js";
import type { State } from "./types.js";
import { VERSION } from "./version.js";

interface Args {
  positionals: string[];
  flags: Record<string, string | true>;
}

function parseArgs(rest: string[]): Args {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

const USAGE = `skillweave v${VERSION}

Usage:
  skillweave run <pipeline.yaml> [--doc <path>] [--inject <mode>]
  skillweave validate <pipeline.yaml>
  skillweave test <skill> [--input <state.json>]
  skillweave list [skills|pipelines]
  skillweave trace [last]
  skillweave new pipeline|skill <name>
  skillweave health
  skillweave sigmap context [--query <q>]
  skillweave sigmap cost [--suggest-tool <task>]
  skillweave providers
  skillweave neutral <file>
  skillweave check-schemas

Inject modes: lowconf · hallucination · persistent · coverage
Judge provider: set ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY (else offline heuristic).`;

function makeState(inject: State["_meta"]["inject"], raw: string): State {
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  return {
    raw_input: raw,
    _meta: { pipeline: "cli", run_id: runId, inject, checkpoints: [] },
  };
}

async function cmdRun(rest: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(rest);
  const path = positionals[0];
  if (!path) {
    console.error("run: missing <pipeline.yaml>");
    return 2;
  }
  let pipeline;
  try {
    pipeline = loadPipeline(path);
  } catch (err) {
    console.error(err instanceof PipelineError ? err.message : String(err));
    return 1;
  }

  const inject = (flags.inject as State["_meta"]["inject"]) ?? "none";
  const raw =
    inject === "coverage"
      ? THIN_DOC
      : typeof flags.doc === "string"
        ? readFileSync(flags.doc, "utf8")
        : SAMPLE_DOC;

  const state = makeState(inject, raw);
  const outcome = await runPipeline(pipeline, state, judgeExecutorLabel(), {
    observe: new SigMapObserveAdapter(),
  });
  if (outcome.status === "halted") {
    console.log(`Fix: address the halt at ${outcome.haltedAt}, then re-run.`);
    return 1;
  }
  return 0;
}

function cmdValidate(rest: string[]): number {
  const { positionals } = parseArgs(rest);
  const path = positionals[0];
  if (!path) {
    console.error("validate: missing <pipeline.yaml>");
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`validate: file not found: ${path}`);
    return 1;
  }
  const issues = validatePipelineFile(path);
  for (const i of issues) console.log(`  [${i.level}] ${i.message}`);
  const errors = issues.filter((i) => i.level === "error").length;
  if (errors > 0) {
    console.log(`✗ ${path}: ${errors} error(s)`);
    return 1;
  }
  console.log(`✓ ${path}: valid${issues.length ? ` (${issues.length} warning(s))` : ""}`);
  return 0;
}

async function cmdTest(rest: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(rest);
  const name = positionals[0];
  if (!name) {
    console.error("test: missing <skill>");
    return 2;
  }
  const skill = getSkill(name);
  if (!skill) {
    console.error(`test: unknown skill '${name}' (try: skillweave list)`);
    return 1;
  }

  const state = makeState("none", SAMPLE_DOC);
  if (typeof flags.input === "string") {
    const input = JSON.parse(readFileSync(flags.input, "utf8")) as Partial<State>;
    Object.assign(state, input, { _meta: state._meta });
  }

  const result = await skill.run(state);
  applyWrites(state, skill, result);
  console.log(`skill: ${skill.name} (${skill.execution_class})`);
  console.log(`  ${result.summary}`);
  if (result.confidence != null) console.log(`  confidence: ${result.confidence}`);
  console.log(`  wrote: ${Object.keys(result.writes).join(", ") || "(nothing)"}`);

  try {
    runAssertions(state, skill);
    console.log(`✓ ${skill.assertions.length} assertion(s) passed`);
    return 0;
  } catch (err) {
    if (err instanceof AssertionError) {
      for (const f of err.failures) console.log(`✗ assertion failed: ${f.statement}`);
      return 1;
    }
    throw err;
  }
}

function cmdList(rest: string[]): number {
  const { positionals } = parseArgs(rest);
  if (positionals[0] === "pipelines") {
    const dir = "pipelines";
    if (!existsSync(dir)) {
      console.log("(no pipelines/ directory)");
      return 0;
    }
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
      console.log(`  ${join(dir, f)}`);
    }
    return 0;
  }
  for (const s of listSkills()) {
    console.log(`  ${s.name.padEnd(20)} ${s.execution_class.padEnd(14)} ${s.does}`);
  }
  return 0;
}

function cmdTrace(): number {
  const dir = "traces";
  if (!existsSync(dir)) {
    console.log("(no traces yet — run a pipeline first)");
    return 0;
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ndjson"))
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!files.length) {
    console.log("(no traces yet — run a pipeline first)");
    return 0;
  }
  const path = join(dir, files[0]!.f);
  console.log(`trace: ${path}`);
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    const judge = r.judge_score != null ? ` judge=${r.judge_score}` : "";
    console.log(
      `  ${String(r.status).padEnd(8)} ${String(r.skill).padEnd(20)} attempt=${r.attempt}${judge}  ${r.summary}`,
    );
  }
  return 0;
}

const PIPELINE_TEMPLATE = (name: string) => `# ${name}.pipeline.yaml — generated by \`skillweave new pipeline\`
name: ${name}
version: 0.1.0
domain: documents

pipeline:
  - skill: parse-input
    execution_class: deterministic
  - skill: validate-coverage
    execution_class: deterministic
  - skill: extract-highlights
    execution_class: probabilistic
    confidence_threshold: 0.80
    retries: 2
  - skill: memory-update
    execution_class: deterministic
`;

const SKILL_TEMPLATE = (name: string, camel: string) => `import type { Skill, State } from "../types.js";

// TODO: register this skill in src/registry.ts
export const ${camel}: Skill = {
  name: "${name}",
  execution_class: "deterministic",
  does: "TODO: one sentence — exactly what this skill does",
  does_not: "TODO: explicit exclusions",
  state_read: [],
  state_write: [],
  assertions: [],
  async run(_state: State) {
    return { writes: {}, summary: "TODO", cost: 0 };
  },
};
`;

function camelCase(name: string): string {
  return name.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
}

function cmdNew(rest: string[]): number {
  const { positionals } = parseArgs(rest);
  const [kind, name] = positionals;
  if ((kind !== "pipeline" && kind !== "skill") || !name) {
    console.error("new: usage — skillweave new pipeline|skill <name>");
    return 2;
  }
  const path = kind === "pipeline" ? join("pipelines", `${name}.pipeline.yaml`) : join("src", "skills", `${name}.ts`);
  if (existsSync(path)) {
    console.error(`new: refusing to overwrite existing file: ${path}`);
    return 1;
  }
  mkdirSync(kind === "pipeline" ? "pipelines" : join("src", "skills"), { recursive: true });
  const content = kind === "pipeline" ? PIPELINE_TEMPLATE(name) : SKILL_TEMPLATE(name, camelCase(name));
  writeFileSync(path, content);
  console.log(`created ${path}`);
  if (kind === "skill") console.log("Remember to register it in src/registry.ts.");
  return 0;
}

function cmdHealth(): number {
  const h = new SigMapObserveAdapter().health();
  console.log(`health: ${h.grade} (${h.score}/100)`);
  console.log(`  runs            : ${h.components.runs}`);
  console.log(`  success rate    : ${(h.components.success_rate * 100).toFixed(0)}%`);
  console.log(`  judge pass rate : ${(h.components.judge_pass_rate * 100).toFixed(0)}%`);
  console.log(`  low-retry rate  : ${(h.components.low_retry_rate * 100).toFixed(0)}%`);
  return 0;
}

function cmdSigmap(rest: string[]): number {
  const { positionals, flags } = parseArgs(rest);
  const sub = positionals[0];
  switch (sub) {
    case "context": {
      const ctx = new SigMapContextAdapter().load(
        typeof flags.query === "string" ? flags.query : undefined,
      );
      if (!ctx.present) {
        console.log(`no SigMap context at ${ctx.source} (run \`sigmap ask\` to generate it)`);
        return 0;
      }
      console.log(`source: ${ctx.source}  (~${ctx.approx_tokens} tokens)`);
      console.log(ctx.content.split("\n").slice(0, 20).join("\n"));
      return 0;
    }
    case "cost": {
      const cost = new SigMapCostAdapter();
      if (typeof flags["suggest-tool"] === "string") {
        console.log(`tier: ${cost.routeModel(flags["suggest-tool"])}`);
      } else {
        console.log(`total cost across traces: $${cost.totalCost().toFixed(4)}`);
      }
      return 0;
    }
    case "health":
      return cmdHealth();
    default:
      console.error("sigmap: usage — skillweave sigmap context|cost|health");
      return 2;
  }
}

function cmdProviders(): number {
  for (const provider of ["anthropic", "google", "openai", "ollama"]) {
    console.log(provider);
    for (const m of loadProfile(provider)) {
      const so = m.supports_structured_output ? "structured" : "no-structured";
      console.log(
        `  ${m.id.padEnd(20)} ${m.tier.padEnd(9)} ${so.padEnd(14)} $${m.cost_per_1k_input}/$${m.cost_per_1k_output} per 1k`,
      );
    }
  }
  return 0;
}

function cmdNeutral(rest: string[]): number {
  const { positionals } = parseArgs(rest);
  const file = positionals[0];
  if (!file) {
    console.error("neutral: missing <file>");
    return 2;
  }
  if (!existsSync(file)) {
    console.error(`neutral: file not found: ${file}`);
    return 1;
  }
  const issues = checkNeutralLanguage(readFileSync(file, "utf8"));
  if (issues.length === 0) {
    console.log(`✓ ${file}: model-neutral`);
    return 0;
  }
  for (const i of issues) console.log(`  [${i.rule}] "${i.match}" — ${i.message}`);
  console.log(`✗ ${file}: ${issues.length} non-neutral reference(s)`);
  return 1;
}

function cmdCheckSchemas(): number {
  const pins = new Set<string>();
  for (const s of listSkills()) {
    if (s.input_schema) pins.add(s.input_schema);
    if (s.output_schema) pins.add(s.output_schema);
  }
  const result = checkSchemas([...pins]);
  for (const d of result.diffs) console.log(`  ${d}`);
  for (const e of result.errors) console.log(`  ✗ ${e}`);
  if (result.ok) {
    console.log(`✓ ${result.schemas} schemas valid · ${pins.size} pins resolve · additive-only holds`);
    return 0;
  }
  console.log(`✗ check-schemas: ${result.errors.length} error(s)`);
  return 1;
}

export async function cli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "run":
      return cmdRun(rest);
    case "validate":
      return cmdValidate(rest);
    case "test":
      return cmdTest(rest);
    case "list":
      return cmdList(rest);
    case "trace":
      return cmdTrace();
    case "new":
      return cmdNew(rest);
    case "health":
      return cmdHealth();
    case "sigmap":
      return cmdSigmap(rest);
    case "providers":
      return cmdProviders();
    case "neutral":
      return cmdNeutral(rest);
    case "check-schemas":
      return cmdCheckSchemas();
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      return 0;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    default:
      console.error(`unknown command: ${cmd}\n\n${USAGE}`);
      return 2;
  }
}

// Run when invoked directly (tsx src/cli.ts ... or the bin shim).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli(process.argv.slice(2)).then((code) => process.exit(code));
}
