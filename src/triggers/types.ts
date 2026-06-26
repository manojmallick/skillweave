// TRIGGER primitive (v1.2.0) — declarative pipeline activation.

/** How a pipeline is activated. */
export type TriggerType =
  | "manual"
  | "file_watch"
  | "git_hook"
  | "git_diff"
  | "webhook"
  | "cron"
  | "pipeline_completion";

/** A human approval gate on a trigger. */
export interface HumanCheckpoint {
  reason: string;
  /** e.g. "24h" — advisory; enforcement is the host's. */
  timeout?: string;
}

/** A trigger declaration, as written in a pipeline's `trigger:` block. */
export interface TriggerSpec {
  type: TriggerType;
  /** Named predicate the host evaluates; gates activation when present. */
  condition?: string;
  /** 5-field cron expression (for `type: cron`). */
  cron?: string;
  /** Shared secret for `type: webhook`. */
  webhook?: { secret?: string };
  /** Approval gate; activation requires `ctx.approved === true`. */
  human_checkpoint?: HumanCheckpoint;
}

/** Runtime signals an activation decision is resolved against. */
export interface ActivationContext {
  /** Current time (for cron). */
  now?: Date;
  /** An upstream completion (for pipeline_completion). */
  event?: { pipeline: string; status: string };
  /** Inbound webhook (for webhook). */
  webhook?: { secret?: string; payload?: unknown };
  /** Result of the host evaluating `spec.condition`. */
  conditionMet?: boolean;
  /** Whether a human approved a declared `human_checkpoint`. */
  approved?: boolean;
}

export interface ActivationResult {
  activate: boolean;
  reason: string;
}
