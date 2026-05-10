import type { Store, IndexedMessage } from "../index-store/store.js";

export type MessageInput = {
  sessionId: string;
  messageUuid?: string;
  contextBefore?: number;
  contextAfter?: number;
};

export type MessageView = {
  sessionId: string;
  resumeCommand: string;
  messages: {
    messageUuid: string;
    ts: string;
    role: "user" | "assistant";
    hasError: boolean;
    content: string;
    isFocus?: boolean;
  }[];
};

const DEFAULT_BEFORE = 1;
const DEFAULT_AFTER = 1;
const MAX_BEFORE = 20;
const MAX_AFTER = 20;
const FULL_SESSION_CAP = 50;

export async function handleMessage(
  store: Store,
  input: MessageInput,
): Promise<MessageView | { error: string }> {
  await store.refresh();

  const fullSessionId = store.resolveSessionId(input.sessionId);
  if (!fullSessionId) {
    return { error: `Session not found: ${input.sessionId}` };
  }

  const all = store.getSessionMessages(fullSessionId);
  if (all.length === 0) {
    return { error: `No indexed messages for session: ${fullSessionId}` };
  }

  if (!input.messageUuid) {
    const trimmed = all.slice(0, FULL_SESSION_CAP);
    return {
      sessionId: fullSessionId,
      resumeCommand: `claude --resume ${fullSessionId}`,
      messages: trimmed.map(toView),
    };
  }

  const focusIdx = all.findIndex((m) => m.messageUuid === input.messageUuid);
  if (focusIdx < 0) {
    return { error: `Message ${input.messageUuid} not in session ${fullSessionId}` };
  }

  const before = clamp(input.contextBefore ?? DEFAULT_BEFORE, 0, MAX_BEFORE);
  const after = clamp(input.contextAfter ?? DEFAULT_AFTER, 0, MAX_AFTER);

  const start = Math.max(0, focusIdx - before);
  const end = Math.min(all.length, focusIdx + after + 1);
  const window = all.slice(start, end);

  return {
    sessionId: fullSessionId,
    resumeCommand: `claude --resume ${fullSessionId}`,
    messages: window.map((m) => ({
      ...toView(m),
      isFocus: m.messageUuid === input.messageUuid,
    })),
  };
}

function toView(m: IndexedMessage) {
  return {
    messageUuid: m.messageUuid,
    ts: m.ts,
    role: m.role,
    hasError: m.hasError,
    content: m.content,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
