// Resolves an ExecutorSpec to an ordered list of provider+model targets and runs
// a function against them with fallback: each target is tried in turn until one
// succeeds.

import type { ExecutorSpec, LLMProviderAdapter, ModelTier, ProviderModel } from "./types.js";

export interface ResolvedTarget {
  adapter: LLMProviderAdapter;
  model: ProviderModel;
}

function parseRef(ref: string): { provider: string; model?: string } {
  const [provider, model] = ref.split("/");
  return { provider: provider!, model };
}

export function resolveTargets(
  spec: ExecutorSpec,
  adapters: Record<string, LLMProviderAdapter>,
  opts: { tier?: ModelTier } = {},
): ResolvedTarget[] {
  const fallbacks = spec.fallback
    ? Array.isArray(spec.fallback)
      ? spec.fallback
      : [spec.fallback]
    : [];
  const targets: ResolvedTarget[] = [];

  for (const ref of [spec.primary, ...fallbacks]) {
    const { provider, model } = parseRef(ref);
    const adapter = adapters[provider];
    if (!adapter) continue;

    let m: ProviderModel | null;
    if (model) {
      m = adapter.models.find((x) => x.id === model) ?? null;
    } else {
      m = adapter.selectModel(opts.tier, spec.requires ?? []);
    }
    if (m) targets.push({ adapter, model: m });
  }
  return targets;
}

export async function runWithFallback<T>(
  targets: ResolvedTarget[],
  fn: (t: ResolvedTarget) => Promise<T>,
): Promise<T> {
  if (targets.length === 0) throw new Error("no provider targets resolved");
  let lastErr: unknown;
  for (const t of targets) {
    try {
      return await fn(t);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
