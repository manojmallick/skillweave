// triggers-and-events — declarative activation (TRIGGER) and routed signals (EVENT).
//
// As a published consumer: import { cronMatches, shouldActivate, EventBus } from "skillweave";
import { cronMatches, EventBus, shouldActivate } from "../src/index.js";

// ── TRIGGER ────────────────────────────────────────────────────────────────
const weekday9am = "0 9 * * 1-5";
console.log("cron 0 9 * * 1-5 @ Mon 09:00 :", cronMatches(weekday9am, new Date(2026, 0, 5, 9, 0)));
console.log("cron 0 9 * * 1-5 @ Sun 09:00 :", cronMatches(weekday9am, new Date(2026, 0, 4, 9, 0)));

console.log("manual                       :", shouldActivate({ type: "manual" }).reason);
console.log(
  "cron (now matches)           :",
  shouldActivate({ type: "cron", cron: weekday9am }, { now: new Date(2026, 0, 5, 9, 0) }).activate,
);
console.log(
  "webhook (secret ok)          :",
  shouldActivate({ type: "webhook", webhook: { secret: "s3cret" } }, { webhook: { secret: "s3cret" } }).activate,
);
console.log(
  "human_checkpoint (no approval):",
  shouldActivate({ type: "manual", human_checkpoint: { reason: "brand review" } }).reason,
);

// ── EVENT ──────────────────────────────────────────────────────────────────
// Subscriptions as you'd write them in a pipeline's `events:` block, plus a custom
// webhook sink (the runtime produces the payload; the host delivers it).
const delivered: string[] = [];
const bus = new EventBus(
  [
    { on: "low_confidence_detected", emit: "warning", notify: ["trace-log"], continue: true },
    { on: "skill_failed", emit: "failure", notify: ["trace-log", "webhook"], continue: false },
  ],
  { webhook: (e) => delivered.push(`${e.type}: ${e.message}`) },
);

console.log("\nemit low_confidence_detected :", bus.emit("low_confidence_detected", { message: "extract-highlights 0.71" }));
console.log("emit skill_failed            :", bus.emit("skill_failed", { message: "judge 0.4 < 0.8" }));
console.log("trace-log entries            :", bus.log.length);
console.log("webhook deliveries           :", delivered);
