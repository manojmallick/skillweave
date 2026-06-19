// Boundary judge engine. Scores how well the parsed content_blocks are
// *grounded* in the raw input. The LLM call routes through the multi-LLM provider
// layer (with primary→fallback); when no provider is configured it falls back to
// a deterministic offline heuristic so the chain still runs end-to-end.
//
// Provider selection (first match wins):
//   JUDGE_PROVIDER=anthropic|gemini|openai|ollama|heuristic   explicit override
//   ANTHROPIC_API_KEY set                                      → anthropic
//   GEMINI_API_KEY / GOOGLE_API_KEY set                        → google
//   OPENAI_API_KEY set                                         → openai
//   OLLAMA_HOST set                                            → ollama
//   otherwise                                                  → heuristic

import {
  buildAdapters,
  resolveTargets,
  runWithFallback,
  type LLMProviderAdapter,
  type ResolvedTarget,
} from "./providers/index.js";
import type { ContentBlock, GoldenAnchor, JudgeVerdict } from "./types.js";

export type JudgeProvider = "anthropic" | "gemini" | "openai" | "ollama" | "heuristic";

export interface JudgeInput {
  raw_input: string;
  content_blocks: ContentBlock[];
  threshold: number;
  golden_anchors?: GoldenAnchor[];
}

/** Estimated cost of the most recent LLM judge call, in USD. */
export let lastJudgeCost = 0;

const NEUTRAL_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    passed: { type: "boolean" },
    confidence: { type: "number" },
    failure_reason: { type: ["string", "null"] },
  },
  required: ["score", "passed", "confidence", "failure_reason"],
  additionalProperties: false,
} as const;

let cachedAdapters: Record<string, LLMProviderAdapter> | null = null;
function adapters(): Record<string, LLMProviderAdapter> {
  if (!cachedAdapters) cachedAdapters = buildAdapters();
  return cachedAdapters;
}

export function selectProvider(): JudgeProvider {
  const explicit = process.env.JUDGE_PROVIDER?.toLowerCase();
  if (
    explicit === "anthropic" ||
    explicit === "gemini" ||
    explicit === "openai" ||
    explicit === "ollama" ||
    explicit === "heuristic"
  ) {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OLLAMA_HOST) return "ollama";
  return "heuristic";
}

const adapterName = (p: JudgeProvider): string => (p === "gemini" ? "google" : p);
const sourceFor = (name: string): JudgeVerdict["source"] =>
  name === "google" ? "gemini" : (name as JudgeVerdict["source"]);

function modelOverride(name: string): string | undefined {
  if (name === "google") return process.env.GEMINI_MODEL;
  if (name === "openai") return process.env.OPENAI_MODEL;
  if (name === "anthropic") return process.env.ANTHROPIC_MODEL;
  if (name === "ollama") return process.env.OLLAMA_MODEL;
  return undefined;
}

/** Ordered judge targets: chosen primary first, then any other available providers. */
function judgeTargets(): ResolvedTarget[] {
  const primary = selectProvider();
  if (primary === "heuristic") return [];
  const ad = adapters();

  const names: string[] = [adapterName(primary)];
  for (const a of Object.values(ad)) {
    if (a.available() && !names.includes(a.name)) names.push(a.name);
  }

  const targets = resolveTargets(
    { primary: names[0]!, fallback: names.slice(1), requires: ["structured_output"] },
    ad,
  );

  // Apply per-provider model overrides from the environment.
  return targets.map((t) => {
    const id = modelOverride(t.adapter.name);
    if (!id) return t;
    const m =
      t.adapter.models.find((x) => x.id === id) ??
      ({ id, tier: "balanced", context_window: 0, supports_structured_output: true, cost_per_1k_input: 0, cost_per_1k_output: 0 } as const);
    return { adapter: t.adapter, model: m };
  });
}

/** Human-readable executor label for the execution summary. */
export function judgeExecutorLabel(): string {
  const targets = judgeTargets();
  if (targets.length === 0) return "heuristic (no LLM key)";
  const t = targets[0]!;
  return `${t.adapter.name}/${t.model.id}`;
}

export async function judge(input: JudgeInput): Promise<JudgeVerdict> {
  lastJudgeCost = 0;
  const targets = judgeTargets();
  if (targets.length === 0) return heuristicJudge(input);

  try {
    return await runWithFallback(targets, async (t) => {
      const result = await t.adapter.complete({
        prompt: buildPrompt(input),
        json_schema: NEUTRAL_SCHEMA as unknown as Record<string, unknown>,
        max_tokens: 4000,
        model: t.model.id,
      });
      lastJudgeCost = result.cost;
      const parsed = JSON.parse(result.text) as Omit<JudgeVerdict, "source">;
      return { ...parsed, source: sourceFor(t.adapter.name) };
    });
  } catch (err) {
    console.warn(
      `  (boundary-judge: all providers failed — ${err instanceof Error ? err.message : String(err)}; falling back to heuristic)`,
    );
    return heuristicJudge(input);
  }
}

/** Shared, model-neutral judge prompt. */
function buildPrompt(input: JudgeInput): string {
  const blocks = input.content_blocks.map((b, i) => `[${i}] (${b.type}) ${b.text}`).join("\n");
  const lines = [
    "You are a groundedness judge. Given a SOURCE document and a set of parsed",
    "CONTENT BLOCKS extracted from it, score how faithfully the blocks are grounded",
    "in the source: 1.0 = every block's content appears in the source with nothing",
    "fabricated; lower scores when blocks contain claims, entities, or text not",
    "present in the source. Be strict about fabricated content.",
    "",
    `Pass threshold: ${input.threshold}. Set passed=true only if score >= threshold.`,
    "Reply as JSON: {score, passed, confidence, failure_reason}.",
  ];
  if (input.golden_anchors?.length) {
    lines.push("", "=== GOLDEN ANCHORS (worked examples of acceptable output) ===");
    input.golden_anchors.forEach((a, i) => {
      lines.push(`Anchor ${i + 1} input:  ${JSON.stringify(a.input)}`);
      lines.push(`Anchor ${i + 1} output: ${JSON.stringify(a.output)}`);
    });
  }
  lines.push("", "=== SOURCE ===", input.raw_input, "", "=== CONTENT BLOCKS ===", blocks);
  return lines.join("\n");
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Offline fallback: per-block fraction of tokens present in the source. */
function heuristicJudge(input: JudgeInput): JudgeVerdict {
  const source = tokens(input.raw_input);
  const ungrounded: number[] = [];
  let sum = 0;

  input.content_blocks.forEach((b, i) => {
    const bt = [...tokens(b.text)];
    if (bt.length === 0) {
      sum += 1;
      return;
    }
    const overlap = bt.filter((t) => source.has(t)).length / bt.length;
    sum += overlap;
    if (overlap < 0.5) ungrounded.push(i);
  });

  const mean = input.content_blocks.length ? sum / input.content_blocks.length : 0;
  const score = Math.max(0, mean - 0.25 * ungrounded.length);
  const passed = score >= input.threshold;
  return {
    score: Number(score.toFixed(3)),
    passed,
    confidence: 0.7,
    failure_reason: passed ? null : `blocks not grounded in source: [${ungrounded.join(", ")}]`,
    source: "heuristic",
  };
}
