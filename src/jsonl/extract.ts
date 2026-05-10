import type { ContentBlock, NormalizedMessage, RawEntry } from "./types.js";
import { stripMetaBlocks } from "./filter.js";
import { redactSecrets } from "./redact.js";

type AnthropicMessage = {
  role?: string;
  content?: unknown;
  stop_reason?: string;
};

const TOOL_RESULT_PREVIEW_LIMIT = 400;

export function extractMessage(entry: RawEntry): NormalizedMessage | null {
  const type = entry.type;
  if (type !== "user" && type !== "assistant") return null;

  const uuid = strField(entry, "uuid");
  const sessionId = strField(entry, "sessionId");
  if (!uuid || !sessionId) return null;

  const message = entry.message as AnthropicMessage | undefined;
  const content = message?.content;

  const blocks = normalizeBlocks(content);
  const text = collectText(blocks);
  const toolUses = collectToolUses(blocks);
  const toolResults = collectToolResults(blocks);

  if (text.length === 0 && toolUses.length === 0 && toolResults.length === 0) {
    return null;
  }

  return {
    uuid,
    parentUuid: strField(entry, "parentUuid"),
    sessionId,
    type: type,
    role: type,
    ts: strField(entry, "timestamp"),
    cwd: strField(entry, "cwd"),
    gitBranch: strField(entry, "gitBranch"),
    isSidechain: boolField(entry, "isSidechain"),
    isMeta: boolField(entry, "isMeta"),
    text,
    toolUses,
    toolResults,
    stopReason: message?.stop_reason ?? null,
  };
}

function strField(entry: RawEntry, key: string): string | null {
  const v = entry[key];
  return typeof v === "string" ? v : null;
}

function boolField(entry: RawEntry, key: string): boolean {
  return entry[key] === true;
}

function normalizeBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return content.filter(
      (b): b is ContentBlock => b !== null && typeof b === "object" && "type" in b,
    );
  }
  return [];
}

function collectText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "text" && "text" in b && typeof b.text === "string") {
      const cleaned = redactSecrets(stripMetaBlocks(b.text));
      if (cleaned.length > 0) parts.push(cleaned);
    }
  }
  return parts.join("\n").trim();
}

function collectToolUses(blocks: ContentBlock[]): { name: string; id?: string }[] {
  const out: { name: string; id?: string }[] = [];
  for (const b of blocks) {
    if (b.type === "tool_use" && "name" in b && typeof b.name === "string") {
      const id = "id" in b && typeof b.id === "string" ? b.id : undefined;
      out.push(id ? { name: b.name, id } : { name: b.name });
    }
  }
  return out;
}

function collectToolResults(blocks: ContentBlock[]): { isError: boolean; preview: string }[] {
  const out: { isError: boolean; preview: string }[] = [];
  for (const b of blocks) {
    if (b.type !== "tool_result") continue;
    const isError =
      "is_error" in b && typeof (b as { is_error?: unknown }).is_error === "boolean"
        ? Boolean((b as { is_error?: boolean }).is_error)
        : false;
    const preview = previewToolResultContent(
      "content" in b ? (b as { content: unknown }).content : null,
    );
    if (isError || preview.length > 0) {
      out.push({ isError, preview });
    }
  }
  return out;
}

function previewToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return redactSecrets(stripMetaBlocks(content)).slice(0, TOOL_RESULT_PREVIEW_LIMIT);
  }
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object" && "type" in block) {
        const b = block as { type: string; text?: unknown };
        if (b.type === "text" && typeof b.text === "string") {
          texts.push(b.text);
        }
      }
    }
    return redactSecrets(stripMetaBlocks(texts.join("\n"))).slice(0, TOOL_RESULT_PREVIEW_LIMIT);
  }
  return "";
}
