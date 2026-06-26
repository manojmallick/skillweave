// EventBus — subscription model + filtering by occurrence name + fan-out across
// routes. No network: each route's default handler collects in memory so the bus
// is fully testable offline. A host can inject real webhook/human delivery.

import type {
  EmitResult,
  EventRoute,
  EventSubscription,
  RouteHandlers,
  SkillEvent,
} from "./types.js";

export interface EmitContext {
  source?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export class EventBus {
  private readonly subs: EventSubscription[] = [];
  private readonly handlers: RouteHandlers;
  /** Events routed to `trace-log` (in-memory default sink). */
  readonly log: SkillEvent[] = [];
  /** Events routed to `webhook` (payloads a host would deliver). */
  readonly deliveries: SkillEvent[] = [];
  /** Events routed to `human` (approval/notification prompts). */
  readonly prompts: SkillEvent[] = [];

  constructor(subscriptions: EventSubscription[] = [], handlers: RouteHandlers = {}) {
    this.subs = [...subscriptions];
    this.handlers = handlers;
  }

  /** Register a subscription after construction. */
  subscribe(sub: EventSubscription): void {
    this.subs.push(sub);
  }

  private route(route: EventRoute, event: SkillEvent): void {
    const custom = this.handlers[route];
    if (custom) {
      custom(event);
      return;
    }
    if (route === "trace-log") this.log.push(event);
    else if (route === "webhook") this.deliveries.push(event);
    else this.prompts.push(event);
  }

  /** Fire a named occurrence; fan out to every matching subscription + route. */
  emit(on: string, ctx: EmitContext = {}): EmitResult {
    let routed = 0;
    let stop = false;
    for (const sub of this.subs) {
      if (sub.on !== on) continue;
      const event: SkillEvent = {
        on,
        type: sub.emit,
        source: ctx.source ?? "orchestrator",
        message: ctx.message ?? on,
        ...(ctx.data ? { data: ctx.data } : {}),
        continue: sub.continue,
      };
      if (!sub.continue) stop = true;
      for (const r of sub.notify) {
        this.route(r, event);
        routed++;
      }
    }
    return { routed, stop };
  }
}
