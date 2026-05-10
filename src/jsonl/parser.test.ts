import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { streamJsonl } from "./parser.js";
import type { RawEntry } from "./types.js";

let dir: string;
let goodFile: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "remind-test-"));
  goodFile = join(dir, "sample.jsonl");
  const lines = [
    JSON.stringify({ type: "user", uuid: "u1", sessionId: "s1" }),
    "this line is not json at all",
    JSON.stringify({ type: "assistant", uuid: "u2", sessionId: "s1" }),
    "",
    JSON.stringify({ type: "permission-mode", sessionId: "s1" }),
    "[1, 2, 3]",
    JSON.stringify({ type: "user", uuid: "u3", sessionId: "s1" }),
  ];
  await writeFile(goodFile, lines.join("\n") + "\n", "utf8");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("streamJsonl", () => {
  it("yields only well-formed JSON objects, skips garbage", async () => {
    const out: RawEntry[] = [];
    for await (const e of streamJsonl(goodFile)) out.push(e);
    expect(out.length).toBe(4);
    expect(out.map((e) => e.type)).toEqual(["user", "assistant", "permission-mode", "user"]);
  });

  it("rejects arrays even if valid JSON", async () => {
    const out: RawEntry[] = [];
    for await (const e of streamJsonl(goodFile)) out.push(e);
    expect(out.find((e) => Array.isArray(e))).toBeUndefined();
  });

  it("respects maxLineBytes cap", async () => {
    const tinyCap = join(dir, "huge.jsonl");
    const huge = JSON.stringify({
      type: "user",
      uuid: "x",
      sessionId: "s",
      payload: "z".repeat(2000),
    });
    await writeFile(tinyCap, huge + "\n", "utf8");
    const out: RawEntry[] = [];
    for await (const e of streamJsonl(tinyCap, { maxLineBytes: 500 })) out.push(e);
    expect(out.length).toBe(0);
  });

  it("does not buffer a giant single line into memory (SEC-H1)", async () => {
    const filePath = join(dir, "huge-line.jsonl");
    const giant = "z".repeat(2_500_000);
    const goodLine = JSON.stringify({ type: "user", uuid: "u1", sessionId: "s1" });
    await writeFile(filePath, giant + "\n" + goodLine + "\n", "utf8");

    const out: RawEntry[] = [];
    for await (const e of streamJsonl(filePath, { maxLineBytes: 1_000_000 })) {
      out.push(e);
    }
    expect(out.length).toBe(1);
    expect(out[0]?.uuid).toBe("u1");
  });

  it("recovers across a dropped huge line and continues parsing (SEC-H1)", async () => {
    const filePath = join(dir, "drop-recover.jsonl");
    const huge = "y".repeat(2_000_000);
    const lines = [
      JSON.stringify({ type: "user", uuid: "a", sessionId: "s" }),
      huge,
      JSON.stringify({ type: "user", uuid: "b", sessionId: "s" }),
    ];
    await writeFile(filePath, lines.join("\n") + "\n", "utf8");

    const out: RawEntry[] = [];
    for await (const e of streamJsonl(filePath, { maxLineBytes: 500_000 })) {
      out.push(e);
    }
    expect(out.map((e) => e.uuid)).toEqual(["a", "b"]);
  });
});
