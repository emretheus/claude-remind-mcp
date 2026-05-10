# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1]

### Added

- `mcpName` field in `package.json` for [MCP Registry](https://registry.modelcontextprotocol.io) ownership verification.
- `server.json` manifest so the package can be listed on the MCP Registry.

## [0.1.0]

Initial public release.

### Added

- BM25 search over local Claude Code conversation history (`~/.claude/projects/`).
- Four MCP tools: `remind_search`, `remind_message`, `remind_session`, `remind_resume`.
- Persistent index at `~/.claude-remind/index.json` with `mtime`-based incremental rebuild.
- Conservative `solvedHint` (`likely` / `unlikely` / `unknown`) derived from session-end signals.
- `format: "compact" | "detailed" | "full"` snippet length control (400 / 1000 / 2000 chars).
- Built-in secret redaction for common credential formats (OpenAI, Anthropic, GitHub, AWS, Stripe, Google, Slack, JWTs, private key blocks, common env assignments).
- Symlink-escape guard during indexing.
- Atomic index persistence (write-temp-then-rename) with `0600` file mode and `0700` directory mode.
- Concurrent refresh guard.
- Configurable via `CLAUDE_CONFIG_DIR` and `CLAUDE_REMIND_DIR` (absolute paths only).

### Security

- Per-line byte cap in JSONL parser to prevent memory exhaustion from oversized lines.
- Per-file caps (5 000 docs, 50 000 messages) to bound index size.
- Stripping of injection-style tags (`<system>`, `<user>`, `<assistant>`, ChatML, Llama `[INST]` / `<<SYS>>`) from indexed content before it returns to the calling agent.
- Sanitized error messages (home directory and long file paths replaced).
