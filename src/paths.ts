import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

function safeAbsoluteOrFallback(envValue: string | undefined, fallback: string): string {
  if (!envValue) return fallback;
  if (!isAbsolute(envValue)) return fallback;
  return resolve(envValue);
}

export function claudeConfigDir(): string {
  return safeAbsoluteOrFallback(process.env.CLAUDE_CONFIG_DIR, join(homedir(), ".claude"));
}

export function projectsDir(): string {
  return join(claudeConfigDir(), "projects");
}

export function remindDataDir(): string {
  return safeAbsoluteOrFallback(process.env.CLAUDE_REMIND_DIR, join(homedir(), ".claude-remind"));
}

export function indexFilePath(): string {
  return join(remindDataDir(), "index.json");
}

export function metaFilePath(): string {
  return join(remindDataDir(), "meta.json");
}

const PROJECT_FOLDER_RE = /^-(.+)$/;

export function decodeProjectFolder(folder: string): string {
  const match = PROJECT_FOLDER_RE.exec(folder);
  if (!match) return folder;
  const body = match[1];
  if (body === undefined) return folder;
  return "/" + body.replace(/-/g, "/");
}

export function encodeProjectFolder(cwd: string): string {
  return cwd.replace(/\//g, "-");
}
