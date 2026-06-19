// Ollama provider adapter — local models via the Ollama HTTP API. Uses fetch
// (no SDK, no shell). Configure with OLLAMA_HOST (default http://localhost:11434).

import { BaseAdapter } from "./base.js";
import type { CompletionRequest, CompletionResult } from "./types.js";

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaAdapter extends BaseAdapter {
  name = "ollama";

  available(): boolean {
    return !!process.env.OLLAMA_HOST;
  }

  private host(): string {
    return process.env.OLLAMA_HOST ?? "http://localhost:11434";
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = this.resolveModel(req);
    const messages: { role: string; content: string }[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    messages.push({ role: "user", content: req.prompt });

    const res = await fetch(`${this.host()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        messages,
        stream: false,
        ...(req.json_schema ? { format: req.json_schema } : {}),
      }),
    });
    if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);

    const data = (await res.json()) as OllamaChatResponse;
    const text = data.message?.content;
    if (!text) throw new Error("empty Ollama response");
    const input = data.prompt_eval_count ?? 0;
    const output = data.eval_count ?? 0;

    return { text, model: model.id, input_tokens: input, output_tokens: output, cost: this.costFor(model, input, output) };
  }
}
