// Anthropic provider adapter (reference implementation).

import Anthropic from "@anthropic-ai/sdk";
import { BaseAdapter } from "./base.js";
import type { CompletionRequest, CompletionResult } from "./types.js";

export class AnthropicAdapter extends BaseAdapter {
  name = "anthropic";

  available(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = this.resolveModel(req);
    const client = new Anthropic();
    // `adaptive` thinking and `output_config` post-date this SDK's static types;
    // the wire body is passed through as-is.
    const body = {
      model: model.id,
      max_tokens: req.max_tokens ?? 4000,
      thinking: { type: "adaptive" },
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      ...(req.json_schema
        ? { output_config: { format: { type: "json_schema", schema: req.json_schema } } }
        : {}),
    } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;

    const response = await client.messages.create(body);
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("no text block in response");

    return {
      text: textBlock.text,
      model: model.id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost: this.costFor(model, response.usage.input_tokens, response.usage.output_tokens),
    };
  }
}
