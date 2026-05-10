import { describe, expect, it } from "vitest";
import { snippet } from "./snippet.js";

describe("snippet", () => {
  it("returns empty for empty content", () => {
    expect(snippet("", "anything")).toBe("");
  });

  it("centers around the first matching term", () => {
    const content = "lorem ".repeat(100) + "TARGET word here " + "ipsum ".repeat(100);
    const out = snippet(content, "TARGET", "compact");
    expect(out).toContain("TARGET");
    expect(out.length).toBeLessThanOrEqual(420);
  });

  it("respects compact (400) length", () => {
    const content = "x".repeat(5000);
    const out = snippet(content, "x", "compact");
    expect(out.length).toBeLessThanOrEqual(420);
  });

  it("respects detailed (1000) length", () => {
    const content = "x".repeat(5000);
    const out = snippet(content, "x", "detailed");
    expect(out.length).toBeLessThanOrEqual(1020);
    expect(out.length).toBeGreaterThan(800);
  });

  it("respects full (2000) length", () => {
    const content = "y".repeat(5000);
    const out = snippet(content, "y", "full");
    expect(out.length).toBeLessThanOrEqual(2020);
    expect(out.length).toBeGreaterThan(1800);
  });

  it("ignores too-short query terms", () => {
    const content = "the quick brown fox jumps over the lazy dog";
    const out = snippet(content, "a b", "compact");
    expect(out.length).toBeGreaterThan(0);
  });

  it("falls back to head slice when no match", () => {
    const content = "hello world ".repeat(100);
    const out = snippet(content, "zzzzz", "compact");
    expect(out.startsWith("hello world")).toBe(true);
  });

  it("adds ellipsis on both sides when window is internal", () => {
    const content = "before ".repeat(50) + "MIDDLE here is the match" + " after".repeat(50);
    const out = snippet(content, "MIDDLE", "compact");
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });
});
