import { createReadStream } from "node:fs";
import type { RawEntry } from "./types.js";

export type ParseOptions = {
  maxLineBytes?: number;
};

const DEFAULT_MAX_LINE_BYTES = 1_000_000;

export async function* streamJsonl(
  filePath: string,
  options: ParseOptions = {},
): AsyncGenerator<RawEntry, void, void> {
  const maxBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
  const stream = createReadStream(filePath, { encoding: "utf8" });

  let buffer = "";
  let dropping = false;

  try {
    for await (const chunk of stream as AsyncIterable<string>) {
      let pending = chunk;
      while (pending.length > 0) {
        const nl = pending.indexOf("\n");
        if (nl < 0) {
          if (dropping) {
            pending = "";
            break;
          }
          if (buffer.length + pending.length > maxBytes) {
            dropping = true;
            buffer = "";
            pending = "";
            break;
          }
          buffer += pending;
          pending = "";
          break;
        }

        const piece = pending.slice(0, nl);
        pending = pending.slice(nl + 1);

        if (dropping) {
          dropping = false;
          buffer = "";
          continue;
        }

        const line = buffer + piece;
        buffer = "";

        if (line.length === 0) continue;
        if (line.length > maxBytes) continue;

        const parsed = safeParse(line);
        if (parsed) yield parsed;
      }
    }

    if (!dropping && buffer.length > 0 && buffer.length <= maxBytes) {
      const parsed = safeParse(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    stream.destroy();
  }
}

function safeParse(line: string): RawEntry | null {
  try {
    const obj = JSON.parse(line) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as RawEntry;
    }
    return null;
  } catch {
    return null;
  }
}
