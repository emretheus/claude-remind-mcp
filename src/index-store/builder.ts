import { basename } from "node:path";
import { streamJsonl } from "../jsonl/parser.js";
import { extractMessage } from "../jsonl/extract.js";
import { isSidecar } from "../jsonl/filter.js";
import type { RawEntry } from "../jsonl/types.js";
import type { IndexDoc, SessionRecord } from "./types.js";

export type FileIndexResult = {
  session: SessionRecord;
  docs: IndexDoc[];
};

const MAX_DOCS_PER_FILE = 5000;
const MAX_MESSAGES_PER_FILE = 50_000;

export async function indexFile(filePath: string): Promise<FileIndexResult | null> {
  const sessionId = basename(filePath, ".jsonl");
  const docs: IndexDoc[] = [];

  let cwd = "";
  let gitBranch = "";
  let aiTitle: string | null = null;
  let firstTs: string | null = null;
  let lastTs: string | null = null;
  let messageCount = 0;
  let hasError = false;
  let lastUserText: string | null = null;
  let lastAssistantStopReason: string | null = null;
  let lastEntryRole: "user" | "assistant" | null = null;
  const toolNames = new Set<string>();
  const files = new Set<string>();

  for await (const entry of streamJsonl(filePath)) {
    if (messageCount >= MAX_MESSAGES_PER_FILE) break;

    captureSidecar(entry, (title) => {
      if (title) aiTitle = title;
    });

    if (isSidecar(entry.type)) continue;

    const msg = extractMessage(entry);
    if (!msg) continue;

    messageCount++;
    if (msg.cwd && !cwd) cwd = msg.cwd;
    if (msg.gitBranch && !gitBranch) gitBranch = msg.gitBranch;
    if (msg.ts) {
      if (!firstTs) firstTs = msg.ts;
      lastTs = msg.ts;
    }

    for (const tu of msg.toolUses) {
      toolNames.add(tu.name);
    }
    if (msg.toolResults.some((r) => r.isError)) {
      hasError = true;
    }

    captureFilesFromText(msg.text, files);

    if (msg.role === "user" && msg.text.length > 0) {
      lastUserText = msg.text;
    }
    if (msg.role === "assistant") {
      lastAssistantStopReason = msg.stopReason;
    }
    lastEntryRole = msg.role;

    if (docs.length >= MAX_DOCS_PER_FILE) continue;

    const docContent = composeDocContent(msg.text, msg.toolUses, msg.toolResults);
    if (docContent.length === 0) continue;

    docs.push({
      id: msg.uuid,
      sessionId,
      cwd: msg.cwd ?? cwd,
      gitBranch: msg.gitBranch ?? gitBranch,
      ts: msg.ts ?? "",
      role: msg.role,
      toolNames: msg.toolUses.map((t) => t.name).join(" "),
      hasError: msg.toolResults.some((r) => r.isError) ? 1 : 0,
      content: docContent,
    });
  }

  if (messageCount === 0) return null;

  const endedCleanly =
    lastEntryRole === "assistant" && lastAssistantStopReason === "end_turn" && !hasError;

  const session: SessionRecord = {
    sessionId,
    filePath,
    cwd,
    gitBranch,
    aiTitle,
    firstTs,
    lastTs,
    messageCount,
    hasError,
    endedCleanly,
    lastUserText,
    lastAssistantStopReason,
    toolNames: [...toolNames],
    files: [...files].slice(0, 100),
  };

  return { session, docs };
}

function captureSidecar(entry: RawEntry, onTitle: (title: string | null) => void): void {
  if (entry.type === "ai-title") {
    const t = entry["aiTitle"];
    if (typeof t === "string") onTitle(t);
  }
}

function composeDocContent(
  text: string,
  toolUses: { name: string }[],
  toolResults: { isError: boolean; preview: string }[],
): string {
  const parts: string[] = [];
  if (text.length > 0) parts.push(text);
  if (toolUses.length > 0) {
    parts.push(toolUses.map((t) => t.name).join(" "));
  }
  for (const r of toolResults) {
    if (r.isError && r.preview.length > 0) {
      parts.push(r.preview);
    }
  }
  return parts.join("\n").slice(0, 8000);
}

const FILE_PATH_RE =
  /(?<![A-Za-z0-9_/.-])(?:\/|\.\/|src\/|app\/)?[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8}\b/g;

function captureFilesFromText(text: string, sink: Set<string>): void {
  if (text.length === 0 || sink.size >= 100) return;
  let m: RegExpExecArray | null;
  FILE_PATH_RE.lastIndex = 0;
  while ((m = FILE_PATH_RE.exec(text)) !== null) {
    if (sink.size >= 100) break;
    const candidate = m[0];
    if (candidate.length > 4 && candidate.length < 200 && candidate.includes(".")) {
      sink.add(candidate);
    }
  }
}
