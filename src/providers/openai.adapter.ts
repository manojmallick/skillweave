// OpenAI provider adapter.

import OpenAI from "openai";
import { BaseAdapter } from "./base.js";
import type { CompletionRequest, CompletionResult } from "./types.js";

export class OpenAIAdapter extends BaseAdapter {
  name = "openai";

  available(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = this.resolveModel(req);
    const client = new OpenAI();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    messages.push({ role: "user", content: req.prompt });

    const completion = await client.chat.completions.create({
      model: model.id,
      max_completion_tokens: req.max_tokens ?? 4000,
      messages,
      ...(req.json_schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "schema", strict: true, schema: req.json_schema },
            },
          }
        : {}),
    });

    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error("empty OpenAI response");
    // OpenAI-compatible proxies (e.g. gateways fronting Gemini/Llama) often
    // ignore `response_format: json_schema` and wrap JSON in a ```json fence.
    // Strip a leading/trailing code fence so structured output still parses.
    const text = req.json_schema ? stripCodeFence(raw) : raw;
    const input = completion.usage?.prompt_tokens ?? 0;
    const output = completion.usage?.completion_tokens ?? 0;

    return { text, model: model.id, input_tokens: input, output_tokens: output, cost: this.costFor(model, input, output) };
  }
}

/** Strip a single wrapping ```/```json code fence, if present. */
function stripCodeFence(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```[a-zA-Z0-9]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}
