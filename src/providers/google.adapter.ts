// Google (Gemini / AI Studio) provider adapter.

import { GoogleGenAI, Type } from "@google/genai";
import { BaseAdapter } from "./base.js";
import type { CompletionRequest, CompletionResult } from "./types.js";

type GeminiSchema = Record<string, unknown>;

function prim(t: string): Type {
  switch (t) {
    case "number":
      return Type.NUMBER;
    case "integer":
      return Type.INTEGER;
    case "boolean":
      return Type.BOOLEAN;
    default:
      return Type.STRING;
  }
}

/** Translate a plain JSON Schema into Gemini's responseSchema shape. */
export function toGemini(schema: Record<string, unknown>): GeminiSchema {
  const t = schema.type;
  if (t === "object") {
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    return {
      type: Type.OBJECT,
      properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, toGemini(v)])),
      required: (schema.required as string[]) ?? Object.keys(props),
      propertyOrdering: (schema.required as string[]) ?? Object.keys(props),
    };
  }
  if (t === "array") {
    const items = (schema.items ?? { type: "string" }) as Record<string, unknown>;
    return { type: Type.ARRAY, items: toGemini(items) };
  }
  if (Array.isArray(t)) {
    const base = t.find((x) => x !== "null") ?? "string";
    return { type: prim(base), nullable: t.includes("null") };
  }
  return { type: prim(t as string) };
}

export class GoogleAdapter extends BaseAdapter {
  name = "google";

  available(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = this.resolveModel(req);
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: model.id,
      contents: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
      config: req.json_schema
        ? { responseMimeType: "application/json", responseSchema: toGemini(req.json_schema) }
        : {},
    });

    const text = response.text;
    if (!text) throw new Error("empty Gemini response");
    const input = response.usageMetadata?.promptTokenCount ?? 0;
    const output = response.usageMetadata?.candidatesTokenCount ?? 0;

    return { text, model: model.id, input_tokens: input, output_tokens: output, cost: this.costFor(model, input, output) };
  }
}
