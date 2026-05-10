# Security Policy

## Supported versions

Only the latest minor release receives security fixes during the `0.x` series.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email **emretheus@users.noreply.github.com** with:

- A description of the issue and its potential impact.
- Steps to reproduce (a minimal proof-of-concept is ideal).
- The version of `claude-remind-mcp` you tested against.

You will get an acknowledgement within 5 business days. After triage we agree on a disclosure timeline; the default is 30 days from acknowledgement to public release.

## Threat model

`claude-remind-mcp` runs locally with the user's privileges over an MCP stdio transport. It reads JSONL files from `~/.claude/projects/` and writes a persistent index to `~/.claude-remind/`. It makes no network calls.

The server treats the contents of conversation logs as **untrusted**: a user may have pasted hostile or attacker-controlled text into a past Claude Code session. To reduce blast radius the server:

- Caps per-line size and per-file document/message counts to bound memory.
- Refuses to follow symlinks under `~/.claude/projects/`.
- Redacts well-known secret formats before indexing.
- Strips system-reminder, command, and chat-template control tags from indexed content so they do not flow back to the calling agent as prompt-injection vectors.
- Writes the index with restrictive file modes (`0600` files, `0700` directory).

The redaction list is best-effort and not exhaustive. Treat the index as sensitive and avoid making `~/.claude-remind/` world-readable. Delete the directory to wipe the cache.

## Out of scope

- Compromise of the host running Claude Code.
- Vulnerabilities in `@modelcontextprotocol/sdk`, `minisearch`, Node.js, or the Claude Code client itself.
- Prompt-injection content the user pastes into a _current_ session (this server can only protect content it indexes from past sessions).
