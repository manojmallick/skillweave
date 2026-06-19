// Multi-LLM provider layer — the interface every provider adapter implements.
// A skill/judge calls `complete()` with a model-neutral request; each adapter
// translates the JSON schema to its provider's structured-output mechanism.

export type ModelTier = "fast" | "balanced" | "powerful";

export interface ProviderModel {
  id: string;
  tier: ModelTier;
  context_window: number;
  supports_structured_output: boolean;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
}

/** A model-neutral completion request. */
export interface CompletionRequest {
  prompt: string;
  system?: string;
  /** Plain JSON Schema the response must satisfy; each adapter translates it. */
  json_schema?: Record<string, unknown>;
  max_tokens?: number;
  /** Explicit model id; otherwise the adapter auto-selects by tier + requirements. */
  model?: string;
}

export interface CompletionResult {
  text: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

export interface LLMProviderAdapter {
  name: string;
  models: ProviderModel[];
  /** True when the provider's credentials/runtime are configured. */
  available(): boolean;
  /** True when some model satisfies every requirement (e.g. "structured_output"). */
  supports(requirements: string[]): boolean;
  /** Pick a model by tier + required capabilities (null if none qualifies). */
  selectModel(tier?: ModelTier, requirements?: string[]): ProviderModel | null;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

/** Pipeline `executor:` declaration — primary provider plus optional fallbacks. */
export interface ExecutorSpec {
  primary: string; // "anthropic" or "anthropic/claude-opus-4-8"
  fallback?: string | string[];
  requires?: string[];
}
