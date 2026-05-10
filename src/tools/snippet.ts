export type SnippetFormat = "compact" | "detailed" | "full";

const LIMITS: Record<SnippetFormat, number> = {
  compact: 400,
  detailed: 1000,
  full: 2000,
};

export function snippet(
  content: string,
  query: string,
  format: SnippetFormat = "detailed",
): string {
  if (!content) return "";
  const limit = LIMITS[format];

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  if (terms.length === 0) return content.slice(0, limit);

  const lower = content.toLowerCase();
  let bestIdx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (bestIdx < 0 || i < bestIdx)) bestIdx = i;
  }
  if (bestIdx < 0) return content.slice(0, limit);

  const before = Math.floor(limit * 0.25);
  const start = Math.max(0, bestIdx - before);
  const end = Math.min(content.length, start + limit);
  let out = content.slice(start, end);
  if (start > 0) out = "…" + out;
  if (end < content.length) out = out + "…";
  return out.replace(/\s+/g, " ").trim();
}
