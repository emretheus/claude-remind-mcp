# claude-remind-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that searches your local [Claude Code](https://docs.anthropic.com/en/docs/claude-code) conversation history so the agent can recall solutions you've already worked out.

**Not Apple Reminders.** This indexes the JSONL files Claude Code writes under `~/.claude/projects/` and exposes a small set of search tools over stdio.

[![npm version](https://img.shields.io/npm/v/claude-remind-mcp.svg)](https://www.npmjs.com/package/claude-remind-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

> Status: experimental (`v0.1.x`). Tool surface is stable; internals may change.

---

## install

**From shell:**

```bash
claude mcp add claude-remind -- npx -y claude-remind-mcp
```

**From any manually configurable `mcp.json`** (Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "claude-remind": {
      "command": "npx",
      "args": ["-y", "claude-remind-mcp"]
    }
  }
}
```

No model downloads, no daemons, no database. The first query builds an index from `~/.claude/projects/` (a few seconds for a typical history) and persists it to `~/.claude-remind/`. Subsequent queries reuse the index and only re-parse files whose mtime changed.

If `npx` resolves the wrong package, force resolution:

```bash
npm install -g claude-remind-mcp
```

---

## tools

Four tools, designed to compose: search → read → resume.

### `remind_search`

BM25 search over past messages. Returns ranked hits with a snippet, a `solvedHint`, a `messageUuid`, and a ready-to-paste `claude --resume` command.

```ts
{
  query: string;
  project?: string;       // substring of cwd, e.g. "my-app"
  limit?: number;         // 1–50, default 5
  sinceDays?: number;     // age filter
  format?: "compact" | "detailed" | "full";  // 400 / 1000 / 2000-char snippet
}
```

```json
[
  {
    "sessionId": "abc12345-...",
    "messageUuid": "msg-9f8e-...",
    "score": 432.8,
    "ts": "2026-04-10T11:30:26Z",
    "role": "assistant",
    "project": "/Users/you/Code/my-app",
    "gitBranch": "deploy",
    "hasError": false,
    "solvedHint": "likely",
    "aiTitle": "RunPod serverless deploy walkthrough",
    "snippet": "Step-by-step: 1) Push the image to NGC 2) Configure the Network Volume…",
    "resumeCommand": "claude --resume abc12345-..."
  }
]
```

Query tips: prefer concrete terms — exact error strings, tool/library names, file paths. Generic words like `auth` or `docker` on their own dilute relevance.

### `remind_message`

Fetch the full text of one message plus optional surrounding turns. Use after `remind_search` returns a `messageUuid` you want to read in full.

```ts
{
  sessionId: string;       // full or 8-char prefix
  messageUuid?: string;    // omit to read whole session (capped at 50 messages)
  contextBefore?: number;  // 0–20, default 1
  contextAfter?: number;   // 0–20, default 1
}
```

The matched message is flagged with `isFocus: true` inside the returned window.

### `remind_session`

Structured summary of a session: title, message count, tool names used, files touched, error count, time span, solved hint, last user message.

```ts
{
  sessionId: string; // full or 8-char prefix
}
```

### `remind_resume`

Resolves a session id (full or 8-char prefix) to a ready-to-run `claude --resume <id>` command, plus the session's cwd and git branch. `remind_search` already returns this on every hit, so prefer that; this tool exists for the case where you only have an id.

---

## how it works

1. Streams every JSONL under `~/.claude/projects/` line-by-line, with a 1 MB per-line cap and a 50 000 message-per-file cap to keep the indexer bounded.
2. Skips Claude Code's sidecar entries (`permission-mode`, `file-history-snapshot`, `attachment`, `system-reminder`, etc.) so only real `user` and `assistant` turns are indexed.
3. Redacts well-known secret patterns (API keys, JWTs, private key blocks, env-style assignments) before content enters the index.
4. Builds a [minisearch](https://github.com/lucaong/minisearch) BM25 index over the message text plus tool names and project path, and persists it atomically to `~/.claude-remind/`.
5. On startup only files whose `mtime` changed are re-parsed.
6. For each session derives `hasError`, `endedCleanly`, last user message, and a conservative `solvedHint` (`likely` only on explicit positive sentiment or a clean end with no errors; `unlikely` only on explicit negative sentiment; `unknown` otherwise).

The on-disk index is a single JSON file. It is safe to delete; the next query rebuilds it.

---

## configuration

| Environment variable | Default            | Purpose                            |
| -------------------- | ------------------ | ---------------------------------- |
| `CLAUDE_CONFIG_DIR`  | `~/.claude`        | Where Claude Code stores its logs. |
| `CLAUDE_REMIND_DIR`  | `~/.claude-remind` | Where the index is persisted.      |

Both must be absolute paths if set; otherwise the default is used.

---

## privacy

The index file at `~/.claude-remind/index.json` is written with mode `0600` and contains the indexed text from your conversations. A built-in regex pass redacts well-known secret formats (OpenAI / Anthropic / GitHub / AWS / Stripe / Google / Slack keys, JWTs, private key blocks, common `KEY=value` env assignments) before content enters the index. This is best-effort; if you've pasted a custom credential format into a past conversation it may not be caught. Delete `~/.claude-remind/` to wipe the index.

The server runs entirely locally over stdio. It makes no network calls.

---

## development

```bash
git clone https://github.com/emretheus/claude-remind-mcp && cd claude-remind-mcp
npm install
npm run build
npm test
```

Scripts:

```bash
npm run build         # TypeScript build with executable permissions on dist/index.js
npm run dev           # tsc --watch
npm run start         # Run the MCP server (stdio)
npm run lint          # ESLint
npm run lint:fix      # ESLint --fix
npm run format        # Prettier write
npm run format:check  # Prettier check
npm run typecheck     # tsc --noEmit
npm test              # Vitest run
```

To point a Claude Code instance at a local checkout:

```bash
claude mcp add claude-remind -- node /absolute/path/to/dist/index.js
```

Smoke-test the MCP handshake from the shell:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  | node dist/index.js
```

Pre-commit runs `lint-staged` (ESLint + Prettier on staged files) via Husky.

---

## requirements

- Node.js ≥ 20
- A Claude Code installation that writes to `~/.claude/projects/`

The package has two runtime dependencies: `@modelcontextprotocol/sdk` and `minisearch`. No native modules.

---

## license

[MIT](LICENSE)
