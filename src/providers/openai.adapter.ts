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

    const text = completion.choices[0]?.message.content;
    if (!text) throw new Error("empty OpenAI response");
    const input = completion.usage?.prompt_tokens ?? 0;
    const output = completion.usage?.completion_tokens ?? 0;

    return { text, model: model.id, input_tokens: input, output_tokens: output, cost: this.costFor(model, input, output) };
  }
}
