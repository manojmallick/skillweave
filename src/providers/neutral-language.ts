// Neutral Skill Language validator. Skill instructions must run on any LLM
// without modification, so they may not reference a specific model/vendor, use
// model-specific thinking-block / XML syntax, or assume a context-window size.

export interface NeutralIssue {
  rule: string;
  match: string;
  message: string;
}

const RULES: { rule: string; re: RegExp; message: string }[] = [
  {
    rule: "vendor-or-model-name",
    re: /\b(claude|chatgpt|gpt-?[0-9][\w.-]*|gemini|bard|anthropic|openai|llama|mistral|ollama|copilot|opus|sonnet|haiku)\b/gi,
    message: "names a specific model or vendor — keep skill instructions model-neutral",
  },
  {
    rule: "thinking-or-xml-tags",
    re: /<\/?(thinking|antthinking|system|function_calls)\b[^>]*>|\bthinking blocks?\b/gi,
    message: "uses model-specific thinking-block / XML-tag syntax",
  },
  {
    rule: "context-window-assumption",
    re: /\b\d{2,4}\s?k\s?(?:token|context)\b|\bcontext window of\b/gi,
    message: "assumes a specific context-window size",
  },
];

export function checkNeutralLanguage(text: string): NeutralIssue[] {
  const issues: NeutralIssue[] = [];
  for (const { rule, re, message } of RULES) {
    re.lastIndex = 0;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const match = m[0];
      const key = match.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        issues.push({ rule, match, message });
      }
    }
  }
  return issues;
}
