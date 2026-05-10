export type SolvedHint = "likely" | "unlikely" | "unknown";

const POSITIVE_RE =
  /\b(thanks|thank you|perfect|works|worked|fixed|fixed it|that did it|nailed it|great|awesome|nice|exactly|done|all good|resolved|got it|works now|tamam|te[şs]ekk[üu]rler|harika|s[uü]per|oldu|çöz[uü]ld[uü])\b/i;

const NEGATIVE_RE =
  /\b(still broken|doesn'?t work|not working|same error|that didn'?t work|nope|no luck|fails?|broken again|hata var|olmad[ıi]|d[üu]zelmedi|çal[ıi][şs]m[ıi]yor)\b/i;

const META_RE =
  /^\s*(?:\[Image:|\[Request interrupted|\[Tool|<command-name>|<system-reminder>|\[Pasted)/i;

export type SolvedSignals = {
  hasError: boolean;
  endedCleanly: boolean;
  lastUserText: string | null;
};

export function classifySolved(s: SolvedSignals): SolvedHint {
  const sentiment = scoreLastUser(s.lastUserText);

  if (sentiment === "negative") return "unlikely";
  if (sentiment === "positive") return "likely";

  if (s.endedCleanly && !s.hasError) return "likely";

  return "unknown";
}

function scoreLastUser(text: string | null): "positive" | "negative" | "neutral" {
  if (!text) return "neutral";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "neutral";
  if (META_RE.test(trimmed)) return "neutral";

  const sample = trimmed.length > 400 ? trimmed.slice(-400) : trimmed;

  const neg = NEGATIVE_RE.test(sample);
  const pos = POSITIVE_RE.test(sample);

  if (pos && !neg) return "positive";
  if (neg && !pos) return "negative";
  return "neutral";
}
