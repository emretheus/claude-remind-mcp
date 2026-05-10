import { classifySolved } from "../classify/solved.js";
import type { Store } from "../index-store/store.js";
import { snippet, type SnippetFormat } from "./snippet.js";

export type SearchInput = {
  query: string;
  project?: string;
  limit?: number;
  sinceDays?: number;
  format?: SnippetFormat;
};

export type SearchHit = {
  sessionId: string;
  messageUuid: string;
  score: number;
  ts: string;
  role: "user" | "assistant";
  project: string;
  gitBranch: string;
  hasError: boolean;
  solvedHint: "likely" | "unlikely" | "unknown";
  aiTitle: string | null;
  snippet: string;
  resumeCommand: string;
};

export async function handleSearch(store: Store, input: SearchInput): Promise<SearchHit[]> {
  await store.refresh();

  const results = store.search(input.query, {
    limit: input.limit ?? 5,
    sinceDays: input.sinceDays,
    project: input.project,
  });

  const format: SnippetFormat = input.format ?? "detailed";

  const hits: SearchHit[] = [];
  for (const r of results) {
    const session = store.getSession(r.sessionId);
    const solvedHint = session
      ? classifySolved({
          hasError: session.hasError,
          endedCleanly: session.endedCleanly,
          lastUserText: session.lastUserText,
        })
      : "unknown";

    hits.push({
      sessionId: r.sessionId,
      messageUuid: r.id,
      score: round(r.score),
      ts: r.ts,
      role: r.role,
      project: r.cwd,
      gitBranch: r.gitBranch,
      hasError: r.hasError,
      solvedHint,
      aiTitle: session?.aiTitle ?? null,
      snippet: snippet(r.content, input.query, format),
      resumeCommand: `claude --resume ${r.sessionId}`,
    });
  }

  return hits;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
