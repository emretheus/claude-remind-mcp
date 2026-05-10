import type { Store } from "../index-store/store.js";

export type ResumeInput = { sessionId: string };

export type ResumeView = {
  sessionId: string;
  command: string;
  cwd: string;
  gitBranch: string;
};

export async function handleResume(
  store: Store,
  input: ResumeInput,
): Promise<ResumeView | { error: string }> {
  await store.refresh();
  const s = store.getSession(input.sessionId);
  if (!s) return { error: `Session not found: ${input.sessionId}` };

  return {
    sessionId: s.sessionId,
    command: `claude --resume ${s.sessionId}`,
    cwd: s.cwd,
    gitBranch: s.gitBranch,
  };
}
