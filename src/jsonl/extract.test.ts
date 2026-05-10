import { describe, expect, it } from "vitest";
import { extractMessage } from "./extract.js";
import type { RawEntry } from "./types.js";

const baseUser: RawEntry = {
  type: "user",
  uuid: "u1",
  sessionId: "s1",
  parentUuid: null,
  timestamp: "2026-01-01T00:00:00Z",
  cwd: "/repo",
  gitBranch: "main",
  isSidechain: false,
  isMeta: false,
};

describe("extractMessage", () => {
  it("returns null for sidecar-like types", () => {
    expect(extractMessage({ ...baseUser, type: "permission-mode" })).toBeNull();
  });

  it("extracts plain string user content", () => {
    const msg = extractMessage({
      ...baseUser,
      message: { role: "user", content: "hello world" },
    });
    expect(msg).not.toBeNull();
    expect(msg!.text).toBe("hello world");
    expect(msg!.role).toBe("user");
  });

  it("flattens text blocks from arrays and strips meta", () => {
    const msg = extractMessage({
      ...baseUser,
      message: {
        role: "user",
        content: [
          { type: "text", text: "real <system-reminder>ignore</system-reminder> stuff" },
          { type: "text", text: "more" },
        ],
      },
    });
    expect(msg!.text).toBe("real  stuff\nmore");
  });

  it("captures tool_use names", () => {
    const msg = extractMessage({
      ...baseUser,
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "t1", name: "Bash", input: { cmd: "ls" } }],
      },
    });
    expect(msg!.toolUses).toEqual([{ name: "Bash", id: "t1" }]);
  });

  it("captures tool_result error flag and preview", () => {
    const msg = extractMessage({
      ...baseUser,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            is_error: true,
            content: "Error: command failed",
          },
        ],
      },
    });
    expect(msg!.toolResults[0]?.isError).toBe(true);
    expect(msg!.toolResults[0]?.preview).toContain("Error: command failed");
  });

  it("handles tool_result content as block array", () => {
    const msg = extractMessage({
      ...baseUser,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: [{ type: "text", text: "block result" }],
          },
        ],
      },
    });
    expect(msg!.toolResults[0]?.preview).toContain("block result");
  });

  it("returns null when no text/tool data after filtering", () => {
    expect(
      extractMessage({
        ...baseUser,
        message: { role: "user", content: [{ type: "text", text: "" }] },
      }),
    ).toBeNull();
  });

  it("propagates stop_reason for assistant turns", () => {
    const msg = extractMessage({
      ...baseUser,
      type: "assistant",
      message: { role: "assistant", content: "ok", stop_reason: "end_turn" },
    });
    expect(msg!.stopReason).toBe("end_turn");
  });

  it("requires uuid and sessionId", () => {
    expect(extractMessage({ ...baseUser, uuid: undefined as unknown as string })).toBeNull();
  });
});
