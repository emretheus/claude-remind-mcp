export type RawEntry = Record<string, unknown> & { type?: string };

export type ToolUseBlock = {
  type: "tool_use";
  id?: string;
  name: string;
  input?: unknown;
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id?: string;
  content: unknown;
  is_error?: boolean;
};

export type TextBlock = { type: "text"; text: string };

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | { type: string };

export type NormalizedMessage = {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  type: "user" | "assistant";
  role: "user" | "assistant";
  ts: string | null;
  cwd: string | null;
  gitBranch: string | null;
  isSidechain: boolean;
  isMeta: boolean;
  text: string;
  toolUses: { name: string; id?: string }[];
  toolResults: { isError: boolean; preview: string }[];
  stopReason: string | null;
};

export type SessionMeta = {
  sessionId: string;
  filePath: string;
  cwd: string | null;
  gitBranch: string | null;
  aiTitle: string | null;
  firstTs: string | null;
  lastTs: string | null;
  messageCount: number;
  hasError: boolean;
  endedCleanly: boolean;
  lastUserText: string | null;
  lastAssistantStopReason: string | null;
};
