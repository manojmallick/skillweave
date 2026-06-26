// SkillWeave orchestrator — drives execution skill-by-skill and owns the v0.2.0
// reliability layer for probabilistic skills:
//   1. confidence routing  — high (>=0.85) proceed · review (0.65–0.85) flag · low (<0.65) retry
//   2. auto-judge          — the boundary judge runs automatically after a probabilistic skill
//   3. retry with negative context — a failing probabilistic skill is re-invoked (budget 2)
//                            with its prior output + the failure reason
// Deterministic skills carry none of this overhead — assertions only, zero retries.

import type { ObservabilityProvider } from "./adapters/types.js";
import { AssertionError, runAssertions } from "./base/base-assert.js";
import { applyWrites, checkpoint } from "./base/base-io.js";
import { Tracer } from "./base/base-log.js";
import { judge, lastJudgeCost } from "./judge.js";
import {
  checkSkillPermissions,
  DEFAULT_POLICY,
  redactSecrets,
  type SecurityPolicy,
} from "./security/index.js";
import type { EventBus } from "./events/index.js";
import type { ConfidenceBand, Pipeline, RetryContext, Skill, State } from "./types.js";

const CONF_HIGH = 0.85;
const CONF_REVIEW = 0.65;
const DEFAULT_RETRIES = 2;

export interface RunOutcome {
  status: "success" | "halted";
  state: State;
  haltedAt?: string;
}

function classifyConfidence(c: number): ConfidenceBand {
  if (c >= CONF_HIGH) return "high";
  if (c >= CONF_REVIEW) return "review";
  return "low";
}

export async function runPipeline(
  pipeline: Pipeline,
  state: State,
  executor: string,
  opts: {
    quiet?: boolean;
    observe?: ObservabilityProvider;
    policy?: SecurityPolicy;
    events?: EventBus;
  } = {},
): Promise<RunOutcome> {
  const tracer = new Tracer(state._meta.run_id);
  const policy = opts.policy ?? DEFAULT_POLICY;
  const emit = (on: string, message: string, data?: Record<string, unknown>) =>
    opts.events?.emit(on, { source: pipeline.name, message, ...(data ? { data } : {}) });
  const printHealth = () => {
    if (opts.quiet || !opts.observe) return;
    const h = opts.observe.health();
    console.log(`health: ${h.grade} (${h.score}/100)  ·  ${h.components.runs} run(s)\n`);
  };

  for (let i = 0; i < pipeline.steps.length; i++) {
    const skill = pipeline.steps[i]!;
    const isProbabilistic = skill.execution_class === "probabilistic";
    const budget = isProbabilistic ? (skill.retries ?? DEFAULT_RETRIES) : 0;

    // Pre-flight: a skill that requests an ungranted/unknown capability is
    // denied (default-deny) and never runs — security halts before execution.
    const perm = checkSkillPermissions(skill, policy);
    if (!perm.ok) {
      const reasons: string[] = [];
      if (perm.denied.length) reasons.push(`denied capabilities: ${perm.denied.join(", ")}`);
      if (perm.unknown.length) reasons.push(`unknown capabilities: ${perm.unknown.join(", ")}`);
      const detail = [redactSecrets(`security: ${reasons.join("; ")}`)];
      tracer.record({
        pipeline: pipeline.name,
        skill: skill.name,
        class: skill.execution_class,
        duration_ms: 0,
        cost: 0,
        judge_score: null,
        confidence: null,
        confidence_band: null,
        attempt: 0,
        status: "halted",
        summary: "DENIED",
        detail,
      });
      emit("skill_failed", `${skill.name} denied by security policy`, { skill: skill.name });
      if (!opts.quiet) tracer.printSummary(pipeline.name, pipeline.version, executor);
      printHealth();
      return { status: "halted", state, haltedAt: skill.name };
    }

    let attempt = 0;
    let retryCtx: RetryContext | undefined;

    while (true) {
      const started = Date.now();
      const result = await skill.run(state, retryCtx);
      applyWrites(state, skill, result);
      checkpoint(state, skill.name, i);
      attempt++;

      let cost = result.cost;
      let band: ConfidenceBand | null = null;
      let judgeScore: number | null = null;
      let failure: string | null = null;

      // 1. confidence routing (probabilistic only)
      if (isProbabilistic && result.confidence != null) {
        band = classifyConfidence(result.confidence);
        if (band === "low") {
          failure = `confidence ${result.confidence.toFixed(2)} below ${CONF_REVIEW}`;
        }
      }

      // 2. assertions (base-assert)
      if (!failure) {
        try {
          runAssertions(state, skill);
        } catch (err) {
          if (err instanceof AssertionError) failure = assertionSummary(err);
          else throw err;
        }
      }

      // 3. auto-judge at the probabilistic boundary
      if (!failure && isProbabilistic && result.judge_blocks?.length) {
        const threshold = skill.confidence_threshold ?? 0.8;
        const verdict = await judge({
          raw_input: state.raw_input ?? "",
          content_blocks: result.judge_blocks,
          threshold,
          golden_anchors: skill.golden_anchors,
        });
        state.judge = verdict;
        cost += lastJudgeCost;
        judgeScore = verdict.score;
        if (!verdict.passed) {
          failure = `judge ${verdict.score} < ${threshold}${verdict.failure_reason ? ` — ${verdict.failure_reason}` : ""}`;
        }
      }

      const base = {
        pipeline: pipeline.name,
        skill: skill.name,
        class: skill.execution_class,
        duration_ms: Date.now() - started,
        cost,
        judge_score: judgeScore,
        confidence: result.confidence ?? null,
        confidence_band: band,
        attempt,
      };

      if (!failure) {
        tracer.record({ ...base, status: "success", summary: result.summary });
        if (band === "review") {
          emit("low_confidence_detected", `${skill.name} confidence in review band`, {
            skill: skill.name,
            confidence: result.confidence,
          });
        }
        break;
      }

      if (attempt <= budget) {
        tracer.record({ ...base, status: "retry", summary: result.summary, detail: [failure] });
        retryCtx = { attempt, previous_summary: result.summary, failure_reason: failure };
        continue;
      }

      // budget exhausted — halt and expose
      const detail = [failure];
      if (budget > 0) detail.push(`exhausted retry budget (${budget})`);
      tracer.record({ ...base, status: "halted", summary: "FAILED", detail });
      emit("skill_failed", `${skill.name} failed: ${failure}`, { skill: skill.name });
      if (!opts.quiet) tracer.printSummary(pipeline.name, pipeline.version, executor);
      printHealth();
      return { status: "halted", state, haltedAt: skill.name };
    }
  }

  emit("pipeline_succeeded", `${pipeline.name} completed`);
  if (!opts.quiet) tracer.printSummary(pipeline.name, pipeline.version, executor);
  printHealth();
  return { status: "success", state };
}

function assertionSummary(err: AssertionError): string {
  return err.failures
    .map((f) => `assertion failed: "${f.statement}"${f.detail ? ` — ${f.detail}` : ""}`)
    .join("; ");
}

/** Re-exported for tests and tools that classify confidence the same way. */
export { classifyConfidence };
export type { Skill };
