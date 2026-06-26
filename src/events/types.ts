// EVENT primitive (v1.2.0) — typed observability signals with declarative,
// routed subscriptions. Local-first: route handlers default to in-memory
// collection; real webhook/human delivery is the host's responsibility.

/** Severity of an emitted signal. */
export type EventType = "info" | "warning" | "alert" | "failure";

/** Where a matched event is routed. */
export type EventRoute = "trace-log" | "webhook" | "human";

/** A concrete signal handed to a route. */
export interface SkillEvent {
  /** The named occurrence that fired this event (e.g. "low_confidence_detected"). */
  on: string;
  type: EventType;
  source: string;
  message: string;
  data?: Record<string, unknown>;
  /** When false, the emitter should stop (halt the pipeline). */
  continue: boolean;
}

/** A declarative subscription, as written in a pipeline's `events:` block. */
export interface EventSubscription {
  /** The occurrence name this subscription reacts to. */
  on: string;
  /** Severity to emit. */
  emit: EventType;
  /** Routes to fan the event out to. */
  notify: EventRoute[];
  /** Whether the pipeline continues after this event (default true). */
  continue: boolean;
}

/** Pluggable per-route delivery handlers (default: collect in memory). */
export interface RouteHandlers {
  "trace-log"?: (event: SkillEvent) => void;
  webhook?: (event: SkillEvent) => void;
  human?: (event: SkillEvent) => void;
}

/** Outcome of emitting one named occurrence. */
export interface EmitResult {
  /** Number of (subscription × route) deliveries performed. */
  routed: number;
  /** True when a matched subscription declared `continue: false`. */
  stop: boolean;
}
