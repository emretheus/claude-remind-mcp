export type IndexDoc = {
  id: string;
  sessionId: string;
  cwd: string;
  gitBranch: string;
  ts: string;
  role: "user" | "assistant";
  toolNames: string;
  hasError: 0 | 1;
  content: string;
};

export type FileMeta = {
  mtimeMs: number;
  sessionId: string;
  docIds: string[];
};

export type StoreMeta = {
  version: 1;
  builtAt: string;
  files: Record<string, FileMeta>;
  sessions: Record<string, SessionRecord>;
};

export type SessionRecord = {
  sessionId: string;
  filePath: string;
  cwd: string;
  gitBranch: string;
  aiTitle: string | null;
  firstTs: string | null;
  lastTs: string | null;
  messageCount: number;
  hasError: boolean;
  endedCleanly: boolean;
  lastUserText: string | null;
  lastAssistantStopReason: string | null;
  toolNames: string[];
  files: string[];
};
