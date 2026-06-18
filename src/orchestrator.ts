// SkillWeave orchestrator — reads a pipeline, drives execution skill-by-skill,
// applies STATE writes via base-io, runs base-assert at each boundary, traces
// via base-log, and halts-and-exposes on failure.

import { AssertionError, runAssertions } from "./base/base-assert.js";
import { applyWrites, checkpoint } from "./base/base-io.js";
import { Tracer } from "./base/base-log.js";
import type { Pipeline, State } from "./types.js";

export interface RunOutcome {
  status: "success" | "halted";
  state: State;
  haltedAt?: string;
}

export async function runPipeline(
  pipeline: Pipeline,
  state: State,
  executor: string,
): Promise<RunOutcome> {
  const tracer = new Tracer(state._meta.run_id);
  let outcome: RunOutcome = { status: "success", state };

  for (let i = 0; i < pipeline.steps.length; i++) {
    const skill = pipeline.steps[i]!;
    const started = Date.now();
    try {
      const result = await skill.run(state);
      applyWrites(state, skill, result);
      checkpoint(state, skill.name, i);
      runAssertions(state, skill); // base-assert — halts on failure

      tracer.record({
        pipeline: pipeline.name,
        skill: skill.name,
        class: skill.execution_class,
        duration_ms: Date.now() - started,
        cost: result.cost,
        judge_score: state.judge && skill.name === "boundary-judge" ? state.judge.score : null,
        confidence: result.confidence ?? null,
        status: "success",
        summary: result.summary,
      });
    } catch (err) {
      outcome = { status: "halted", state, haltedAt: skill.name };
      tracer.record({
        pipeline: pipeline.name,
        skill: skill.name,
        class: skill.execution_class,
        duration_ms: Date.now() - started,
        cost: state.judge?.source === "anthropic" ? 0 : 0,
        judge_score: skill.name === "boundary-judge" ? (state.judge?.score ?? null) : null,
        confidence: state.judge?.confidence ?? null,
        status: "halted",
        summary: "FAILED",
        detail: failureDetail(err),
      });
      tracer.printSummary(pipeline.name, pipeline.version, executor);
      return outcome;
    }
  }

  tracer.printSummary(pipeline.name, pipeline.version, executor);
  return outcome;
}

function failureDetail(err: unknown): string[] {
  if (err instanceof AssertionError) {
    return err.failures.map(
      (f) => `assertion failed: "${f.statement}"${f.detail ? ` — ${f.detail}` : ""}`,
    );
  }
  if (err instanceof Error) return [`error: ${err.message}`];
  return [`error: ${String(err)}`];
}
