#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Store } from "./index-store/store.js";
import { handleMessage } from "./tools/message.js";
import { handleResume } from "./tools/resume.js";
import { handleSearch } from "./tools/search.js";
import { handleSession } from "./tools/session.js";
import type { SnippetFormat } from "./tools/snippet.js";

const SERVER_NAME = "claude-remind";
const SERVER_VERSION = "0.1.1";

const TOOLS = [
  {
    name: "remind_search",
    description:
      'Search past Claude Code sessions for solutions to recurring problems. Returns BM25-ranked hits with a snippet, a `solvedHint`, a `messageUuid`, and a ready-to-paste `claude --resume <id>` command.\n\nWhen to use: at the start of a task to check for prior work on the same codebase; or when the user mentions an error, tool, or feature they may have already solved. One call is usually enough — only re-call with a different query if the first returned no useful hits.\n\nQuery tips: use specific concrete terms — exact error strings (`ExpiredTokenException`, `LoginRefreshRequired`), tool/lib names (`BuildKit`, `Cognito`, `Tailwind`), or real file paths (`tailwind.config`, `shared_auth/jwt.py`). Avoid generic words that flood the corpus (e.g. `AWS`, `auth`, `docker` on their own). Good: `ExpiredTokenException SendSSHPublicKey`. Bad: `AWS auth issue`.\n\nCost: ~1–2 KB per call at default (5 hits, 1000-char snippets). Use `format: "compact"` (400 chars) for cheap scans, `format: "full"` (2000 chars) when you need to read in place. After finding a relevant hit, call `remind_message` with its `messageUuid` to read the full content.',
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query." },
        project: {
          type: "string",
          description: "Optional. Substring match against the session's cwd (e.g. 'my-app').",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        sinceDays: {
          type: "integer",
          minimum: 1,
          description: "Optional. Only include sessions updated within the last N days.",
        },
        format: {
          type: "string",
          enum: ["compact", "detailed", "full"],
          default: "detailed",
          description: "Snippet length: compact=400, detailed=1000, full=2000 chars.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "remind_message",
    description:
      "Fetch the full text of a specific past message, plus optional surrounding turns. Returns up to ~10 KB; the matched message is flagged with `isFocus: true` inside the returned window.\n\nWhen to use: only after `remind_search` returns a `messageUuid` whose snippet looks promising but is truncated. Don't call this for every search hit — pick the one or two most relevant first. If you want a structural overview of the whole session (tools, files, errors), call `remind_session` instead.\n\nTo read the entire session, omit `messageUuid` (capped at 50 messages).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Full or prefix of the session UUID." },
        messageUuid: {
          type: "string",
          description:
            "Optional. If provided, returns this message plus context window. If omitted, returns all indexed messages of the session (capped at 50).",
        },
        contextBefore: {
          type: "integer",
          minimum: 0,
          maximum: 20,
          default: 1,
          description: "Messages before the focus message.",
        },
        contextAfter: {
          type: "integer",
          minimum: 0,
          maximum: 20,
          default: 1,
          description: "Messages after the focus message.",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "remind_session",
    description:
      "Get a structured summary of one past session: title, message count, tool names used, files touched, error count, time span, solved hint, and the last user message. Cheap (~1 KB).\n\nWhen to use: when a `remind_search` hit looks relevant and you need the bigger picture (was this session productive? which tools/files were involved?) before drilling into specific messages. Requires a `sessionId` — the 8-char prefix from a search hit is enough. To read message bodies, use `remind_message` instead.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Full or prefix of the Claude session UUID.",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "remind_resume",
    description:
      "Resolve a (full or 8-char prefix) session id into a ready-to-run `claude --resume <id>` command, plus the session's cwd and git branch.\n\nWhen to use: only when you already have a sessionId in hand and need just the resume command. `remind_search` already returns `resumeCommand` on every hit, so prefer that. This tool exists for cases where the user pastes a bare sessionId or a previous tool flow stored only the id.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Full or prefix of the Claude session UUID." },
      },
      required: ["sessionId"],
    },
  },
];

async function main(): Promise<void> {
  const store = new Store();

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "remind_search": {
          const query = typeof input.query === "string" ? input.query.slice(0, 1000) : "";
          const project =
            typeof input.project === "string" ? input.project.slice(0, 256) : undefined;
          const limit = clampInt(input.limit, 1, 50, 5);
          const sinceDays = clampInt(input.sinceDays, 1, 3650, undefined);
          const format = parseFormat(input.format);
          const hits = await handleSearch(store, { query, project, limit, sinceDays, format });
          return jsonReply(hits);
        }
        case "remind_message": {
          const sessionId = typeof input.sessionId === "string" ? input.sessionId : "";
          const messageUuid = typeof input.messageUuid === "string" ? input.messageUuid : undefined;
          const contextBefore =
            typeof input.contextBefore === "number" ? input.contextBefore : undefined;
          const contextAfter =
            typeof input.contextAfter === "number" ? input.contextAfter : undefined;
          const view = await handleMessage(store, {
            sessionId,
            messageUuid,
            contextBefore,
            contextAfter,
          });
          return jsonReply(view);
        }
        case "remind_session": {
          const sessionId = typeof input.sessionId === "string" ? input.sessionId : "";
          const view = await handleSession(store, { sessionId });
          return jsonReply(view);
        }
        case "remind_resume": {
          const sessionId = typeof input.sessionId === "string" ? input.sessionId : "";
          const view = await handleResume(store, { sessionId });
          return jsonReply(view);
        }
        default:
          return jsonReply({ error: `Unknown tool: ${name}` }, true);
      }
    } catch (err) {
      return jsonReply({ error: sanitizeError(err) }, true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function jsonReply(payload: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function parseFormat(v: unknown): SnippetFormat | undefined {
  if (v === "compact" || v === "detailed" || v === "full") return v;
  return undefined;
}

function clampInt<T extends number | undefined>(
  v: unknown,
  lo: number,
  hi: number,
  fallback: T,
): number | T {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  let cleaned = raw;
  if (home) cleaned = cleaned.split(home).join("~");
  cleaned = cleaned.replace(/(?:\/[A-Za-z0-9._-]+){3,}/g, "[path]");
  return cleaned.slice(0, 200);
}

main().catch((error: unknown) => {
  console.error("[claude-remind] fatal:", error);
  process.exit(1);
});
