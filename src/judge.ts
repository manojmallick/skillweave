// Boundary judge engine. Scores how well the parsed content_blocks are
// *grounded* in the raw input — i.e. whether parse-input fabricated or dropped
// content. Provider-pluggable: Claude (Anthropic), Gemini (Google AI Studio), or
// OpenAI when a key is present; otherwise a deterministic token-overlap heuristic
// so the chain still runs end-to-end offline.
//
// Provider selection (first match wins):
//   JUDGE_PROVIDER=anthropic|gemini|openai|heuristic   explicit override
//   ANTHROPIC_API_KEY set                               → anthropic
//   GEMINI_API_KEY / GOOGLE_API_KEY set                 → gemini
//   OPENAI_API_KEY set                                  → openai
//   otherwise                                           → heuristic

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import type { ContentBlock, GoldenAnchor, JudgeVerdict } from "./types.js";

const ANTHROPIC_MODEL = "claude-opus-4-8";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type JudgeProvider = "anthropic" | "gemini" | "openai" | "heuristic";

export interface JudgeInput {
  raw_input: string;
  content_blocks: ContentBlock[];
  threshold: number;
  golden_anchors?: GoldenAnchor[];
}

/** Estimated cost of the most recent LLM judge call, in USD. */
export let lastJudgeCost = 0;

export function selectProvider(): JudgeProvider {
  const explicit = process.env.JUDGE_PROVIDER?.toLowerCase();
  if (
    explicit === "anthropic" ||
    explicit === "gemini" ||
    explicit === "openai" ||
    explicit === "heuristic"
  ) {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "heuristic";
}

/** Human-readable executor label for the execution summary. */
export function judgeExecutorLabel(): string {
  switch (selectProvider()) {
    case "anthropic":
      return `anthropic/${ANTHROPIC_MODEL}`;
    case "gemini":
      return `google/${GEMINI_MODEL}`;
    case "openai":
      return `openai/${OPENAI_MODEL}`;
    default:
      return "heuristic (no LLM key)";
  }
}

export async function judge(input: JudgeInput): Promise<JudgeVerdict> {
  lastJudgeCost = 0;
  const provider = selectProvider();

  if (provider === "anthropic") {
    try {
      return await anthropicJudge(input);
    } catch (err) {
      warnFallback("Anthropic", err);
    }
  } else if (provider === "gemini") {
    try {
      return await geminiJudge(input);
    } catch (err) {
      warnFallback("Gemini", err);
    }
  } else if (provider === "openai") {
    try {
      return await openaiJudge(input);
    } catch (err) {
      warnFallback("OpenAI", err);
    }
  }
  return heuristicJudge(input);
}

function warnFallback(name: string, err: unknown): void {
  console.warn(
    `  (boundary-judge: ${name} call failed — ${err instanceof Error ? err.message : String(err)}; falling back to heuristic)`,
  );
}

/** Shared, model-neutral judge prompt. */
function buildPrompt(input: JudgeInput): string {
  const blocks = input.content_blocks
    .map((b, i) => `[${i}] (${b.type}) ${b.text}`)
    .join("\n");
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

const ANTHROPIC_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "Groundedness 0.0–1.0" },
    passed: { type: "boolean" },
    confidence: { type: "number", description: "0.0–1.0" },
    failure_reason: { type: ["string", "null"] },
  },
  required: ["score", "passed", "confidence", "failure_reason"],
  additionalProperties: false,
} as const;

async function anthropicJudge(input: JudgeInput): Promise<JudgeVerdict> {
  const client = new Anthropic();
  // `adaptive` thinking and `output_config` are current API features that
  // post-date this SDK's static types; the wire body is passed through as-is.
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: buildPrompt(input) }],
    output_config: { format: { type: "json_schema", schema: ANTHROPIC_SCHEMA } },
  } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;

  const response = await client.messages.create(body);

  lastJudgeCost =
    (response.usage.input_tokens * 5) / 1_000_000 +
    (response.usage.output_tokens * 25) / 1_000_000;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("no text block in judge response");
  }
  const parsed = JSON.parse(textBlock.text) as Omit<JudgeVerdict, "source">;
  return { ...parsed, source: "anthropic" };
}

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    passed: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
    failure_reason: { type: Type.STRING, nullable: true },
  },
  required: ["score", "passed", "confidence", "failure_reason"],
  propertyOrdering: ["score", "passed", "confidence", "failure_reason"],
};

async function geminiJudge(input: JudgeInput): Promise<JudgeVerdict> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("empty Gemini response");

  // gemini-2.5-flash list pricing (approx, USD/1M tokens): $0.30 in / $2.50 out.
  const usage = response.usageMetadata;
  lastJudgeCost =
    ((usage?.promptTokenCount ?? 0) * 0.3) / 1_000_000 +
    ((usage?.candidatesTokenCount ?? 0) * 2.5) / 1_000_000;

  const parsed = JSON.parse(text) as Omit<JudgeVerdict, "source">;
  return { ...parsed, source: "gemini" };
}

const OPENAI_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "Groundedness 0.0–1.0" },
    passed: { type: "boolean" },
    confidence: { type: "number", description: "0.0–1.0" },
    failure_reason: { type: ["string", "null"] },
  },
  required: ["score", "passed", "confidence", "failure_reason"],
  additionalProperties: false,
} as const;

async function openaiJudge(input: JudgeInput): Promise<JudgeVerdict> {
  const client = new OpenAI();

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: buildPrompt(input) }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "groundedness", strict: true, schema: OPENAI_SCHEMA },
    },
  });

  // gpt-4o-mini list pricing (approx, USD/1M tokens): $0.15 in / $0.60 out.
  const usage = completion.usage;
  lastJudgeCost =
    ((usage?.prompt_tokens ?? 0) * 0.15) / 1_000_000 +
    ((usage?.completion_tokens ?? 0) * 0.6) / 1_000_000;

  const text = completion.choices[0]?.message.content;
  if (!text) throw new Error("empty OpenAI response");

  const parsed = JSON.parse(text) as Omit<JudgeVerdict, "source">;
  return { ...parsed, source: "openai" };
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

  // Mean overlap, then a fabrication penalty so a single clearly-ungrounded
  // block can't be diluted past the threshold by surrounding faithful blocks.
  const mean = input.content_blocks.length ? sum / input.content_blocks.length : 0;
  const score = Math.max(0, mean - 0.25 * ungrounded.length);
  const passed = score >= input.threshold;
  return {
    score: Number(score.toFixed(3)),
    passed,
    confidence: 0.7,
    failure_reason: passed
      ? null
      : `blocks not grounded in source: [${ungrounded.join(", ")}]`,
    source: "heuristic",
  };
}
