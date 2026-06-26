// TRIGGER primitive (v1.2.0) — public surface.

export { cronMatches } from "./cron.js";
export { shouldActivate } from "./resolve.js";
export type {
  ActivationContext,
  ActivationResult,
  HumanCheckpoint,
  TriggerSpec,
  TriggerType,
} from "./types.js";
