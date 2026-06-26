// shouldActivate — resolves a TriggerSpec against runtime context into an
// activation decision. Pure: external triggers (file_watch / git_hook /
// git_diff) are fired by the environment, not evaluated here.

import { cronMatches } from "./cron.js";
import type { ActivationContext, ActivationResult, TriggerSpec } from "./types.js";

const deny = (reason: string): ActivationResult => ({ activate: false, reason });
const allow = (reason: string): ActivationResult => ({ activate: true, reason });

/** Decide whether a trigger activates given the current context. */
export function shouldActivate(spec: TriggerSpec, ctx: ActivationContext = {}): ActivationResult {
  // Gates applied to every type: a declared condition / approval must hold.
  if (spec.human_checkpoint && ctx.approved !== true) {
    return deny(`awaiting human approval: ${spec.human_checkpoint.reason}`);
  }
  if (spec.condition && ctx.conditionMet !== true) {
    return deny(`condition not met: ${spec.condition}`);
  }

  switch (spec.type) {
    case "manual":
      return allow("manual activation");

    case "cron": {
      if (!spec.cron) return deny("cron trigger missing a cron expression");
      if (!ctx.now) return deny("cron trigger needs a reference time");
      return cronMatches(spec.cron, ctx.now)
        ? allow(`cron matched: ${spec.cron}`)
        : deny(`cron did not match: ${spec.cron}`);
    }

    case "webhook": {
      if (!ctx.webhook) return deny("no inbound webhook");
      const expected = spec.webhook?.secret;
      if (expected && expected !== ctx.webhook.secret) return deny("webhook secret mismatch");
      return allow("webhook accepted");
    }

    case "pipeline_completion":
      return ctx.event
        ? allow(`upstream completion: ${ctx.event.pipeline} (${ctx.event.status})`)
        : deny("no upstream completion event");

    default:
      // file_watch | git_hook | git_diff — fired by the environment.
      return deny(`${spec.type} is fired by the environment, not resolved in-process`);
  }
}
