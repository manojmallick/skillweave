// Secret redaction — scrubs provider API-key values out of any string before it
// can reach a diagnostic, summary, or trace. Backs the SECURITY.md guarantee
// that keys are never written to disk or the trace logs.

/** Environment variables whose values are treated as secrets. */
export const SECRET_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
] as const;

/**
 * Replace every occurrence of a configured key's value in `text` with a
 * `«REDACTED:NAME»` marker. Reads values from `env` (defaults to process.env);
 * empty/unset values are skipped so nothing is over-matched.
 */
export function redactSecrets(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let out = text;
  for (const name of SECRET_ENV_KEYS) {
    const value = env[name];
    if (!value) continue;
    out = out.split(value).join(`«REDACTED:${name}»`);
  }
  return out;
}
