// Multi-LLM provider layer — public surface.

import { AnthropicAdapter } from "./anthropic.adapter.js";
import { GoogleAdapter } from "./google.adapter.js";
import { OllamaAdapter } from "./ollama.adapter.js";
import { OpenAIAdapter } from "./openai.adapter.js";
import { loadProfile } from "./profiles.js";
import type { LLMProviderAdapter } from "./types.js";

/** Construct every provider adapter from its capability profile. */
export function buildAdapters(dir?: string): Record<string, LLMProviderAdapter> {
  return {
    anthropic: new AnthropicAdapter(loadProfile("anthropic", dir)),
    google: new GoogleAdapter(loadProfile("google", dir)),
    openai: new OpenAIAdapter(loadProfile("openai", dir)),
    ollama: new OllamaAdapter(loadProfile("ollama", dir)),
  };
}

export * from "./types.js";
export { loadProfile } from "./profiles.js";
export { resolveTargets, runWithFallback } from "./executor.js";
export type { ResolvedTarget } from "./executor.js";
export { checkNeutralLanguage } from "./neutral-language.js";
export type { NeutralIssue } from "./neutral-language.js";
export { AnthropicAdapter } from "./anthropic.adapter.js";
export { GoogleAdapter } from "./google.adapter.js";
export { OpenAIAdapter } from "./openai.adapter.js";
export { OllamaAdapter } from "./ollama.adapter.js";
