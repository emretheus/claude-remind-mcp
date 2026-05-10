import { describe, expect, it } from "vitest";
import { isMeaningful, isSidecar, stripMetaBlocks } from "./filter.js";

describe("isSidecar", () => {
  it("flags known sidecar types", () => {
    expect(isSidecar("permission-mode")).toBe(true);
    expect(isSidecar("file-history-snapshot")).toBe(true);
    expect(isSidecar("attachment")).toBe(true);
    expect(isSidecar("ai-title")).toBe(true);
    expect(isSidecar("system")).toBe(true);
    expect(isSidecar("queue-operation")).toBe(true);
  });

  it("does not flag conversational types", () => {
    expect(isSidecar("user")).toBe(false);
    expect(isSidecar("assistant")).toBe(false);
  });

  it("treats missing type as sidecar (defensive)", () => {
    expect(isSidecar(undefined)).toBe(true);
  });
});

describe("stripMetaBlocks", () => {
  it("removes <system-reminder> blocks", () => {
    const input = "before <system-reminder>noise here</system-reminder> after";
    expect(stripMetaBlocks(input)).toBe("before  after");
  });

  it("removes <command-name> blocks", () => {
    expect(stripMetaBlocks("hi <command-name>x</command-name> there")).toBe("hi  there");
  });

  it("removes local-command-stdout/stderr", () => {
    const input = "<local-command-stdout>foo</local-command-stdout>";
    expect(stripMetaBlocks(input)).toBe("");
  });

  it("leaves plain content untouched", () => {
    expect(stripMetaBlocks("just text")).toBe("just text");
  });

  it("trims trailing whitespace", () => {
    expect(stripMetaBlocks("  text  ")).toBe("text");
  });
});

describe("isMeaningful", () => {
  it("rejects very short strings", () => {
    expect(isMeaningful("")).toBe(false);
    expect(isMeaningful("ok")).toBe(false);
  });

  it("accepts substantive strings", () => {
    expect(isMeaningful("hello there")).toBe(true);
  });
});
