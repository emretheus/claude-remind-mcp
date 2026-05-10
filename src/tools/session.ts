import { classifySolved } from "../classify/solved.js";
import type { Store } from "../index-store/store.js";

export type SessionInput = { sessionId: string };

export type SessionView = {
  sessionId: string;
  cwd: string;
  gitBranch: string;
  aiTitle: string | null;
  firstTs: string | null;
  lastTs: string | null;
  messageCount: number;
  hasError: boolean;
  endedCleanly: boolean;
  solvedHint: "likely" | "unlikely" | "unknown";
  toolNames: string[];
  files: string[];
  lastUserText: string | null;
  resumeCommand: string;
};

export async function handleSession(
  store: Store,
  input: SessionInput,
): Promise<SessionView | { error: string }> {
  await store.refresh();
  const s = store.getSession(input.sessionId);
  if (!s) return { error: `Session not found: ${input.sessionId}` };

  return {
    sessionId: s.sessionId,
    cwd: s.cwd,
    gitBranch: s.gitBranch,
    aiTitle: s.aiTitle,
    firstTs: s.firstTs,
    lastTs: s.lastTs,
    messageCount: s.messageCount,
    hasError: s.hasError,
    endedCleanly: s.endedCleanly,
    solvedHint: classifySolved({
      hasError: s.hasError,
      endedCleanly: s.endedCleanly,
      lastUserText: s.lastUserText,
    }),
    toolNames: s.toolNames,
    files: s.files,
    lastUserText: s.lastUserText,
    resumeCommand: `claude --resume ${s.sessionId}`,
  };
}
