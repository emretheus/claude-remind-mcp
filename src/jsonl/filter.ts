const SIDECAR_TYPES = new Set([
  "permission-mode",
  "file-history-snapshot",
  "attachment",
  "last-prompt",
  "ai-title",
  "queue-operation",
  "system",
]);

export function isSidecar(type: string | undefined): boolean {
  if (!type) return true;
  return SIDECAR_TYPES.has(type);
}

const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const COMMAND_NAME_RE = /<command-name>[\s\S]*?<\/command-name>/g;
const COMMAND_MESSAGE_RE = /<command-message>[\s\S]*?<\/command-message>/g;
const COMMAND_ARGS_RE = /<command-args>[\s\S]*?<\/command-args>/g;
const LOCAL_COMMAND_STDOUT_RE = /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g;
const LOCAL_COMMAND_STDERR_RE = /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g;

const FAKE_SYSTEM_RE = /<\s*\/?\s*system\s*>/gi;
const FAKE_USER_RE = /<\s*\/?\s*user\s*>/gi;
const FAKE_ASSISTANT_RE = /<\s*\/?\s*assistant\s*>/gi;
const SYS_BRACKETS_RE = /<<\s*SYS\s*>>|<<\s*\/?SYS\s*>>/gi;
const INST_TAG_RE = /\[\s*\/?\s*INST\s*\]/gi;
const CHATML_RE =
  /<\|\s*(?:im_start|im_end|endoftext|im_sep|fim_prefix|fim_suffix|fim_middle)\s*\|>/gi;

export function stripMetaBlocks(text: string): string {
  return text
    .replace(SYSTEM_REMINDER_RE, "")
    .replace(COMMAND_NAME_RE, "")
    .replace(COMMAND_MESSAGE_RE, "")
    .replace(COMMAND_ARGS_RE, "")
    .replace(LOCAL_COMMAND_STDOUT_RE, "")
    .replace(LOCAL_COMMAND_STDERR_RE, "")
    .replace(FAKE_SYSTEM_RE, "[system]")
    .replace(FAKE_USER_RE, "[user]")
    .replace(FAKE_ASSISTANT_RE, "[assistant]")
    .replace(SYS_BRACKETS_RE, "[sys]")
    .replace(INST_TAG_RE, "[inst]")
    .replace(CHATML_RE, "[chatml]")
    .trim();
}

export function isMeaningful(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  return true;
}
