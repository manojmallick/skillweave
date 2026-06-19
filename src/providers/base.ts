// Shared adapter logic: capability matching, model selection, cost.

import type { CompletionRequest, CompletionResult, LLMProviderAdapter, ModelTier, ProviderModel } from "./types.js";

function meetsRequirements(model: ProviderModel, requirements: string[]): boolean {
  return requirements.every((r) => {
    if (r === "structured_output") return model.supports_structured_output;
    return true; // unknown requirement → not constrained
  });
}

export abstract class BaseAdapter implements LLMProviderAdapter {
  abstract name: string;
  constructor(public models: ProviderModel[]) {}

  abstract available(): boolean;
  abstract complete(req: CompletionRequest): Promise<CompletionResult>;

  supports(requirements: string[] = []): boolean {
    return this.models.some((m) => meetsRequirements(m, requirements));
  }

  selectModel(tier?: ModelTier, requirements: string[] = []): ProviderModel | null {
    const candidates = this.models.filter((m) => meetsRequirements(m, requirements));
    if (candidates.length === 0) return null;
    if (tier) {
      return candidates.find((m) => m.tier === tier) ?? candidates[0]!;
    }
    return candidates.find((m) => m.tier === "balanced") ?? candidates[0]!;
  }

  /** Resolve the model to use for a request (explicit id, else auto-select). */
  protected resolveModel(req: CompletionRequest): ProviderModel {
    if (req.model) {
      const found = this.models.find((m) => m.id === req.model);
      if (found) return found;
      // Allow an override id not in the profile (cost unknown → 0).
      return {
        id: req.model,
        tier: "balanced",
        context_window: 0,
        supports_structured_output: true,
        cost_per_1k_input: 0,
        cost_per_1k_output: 0,
      };
    }
    const m = this.selectModel(undefined, req.json_schema ? ["structured_output"] : []);
    if (!m) throw new Error(`${this.name}: no model available`);
    return m;
  }

  protected costFor(model: ProviderModel, input: number, output: number): number {
    return Number(
      ((input / 1000) * model.cost_per_1k_input + (output / 1000) * model.cost_per_1k_output).toFixed(
        6,
      ),
    );
  }
}
