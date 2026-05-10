const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "openai", re: /sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{32,}/g },
  { name: "anthropic", re: /sk-ant-(?:api|admin)[0-9]{2}-[A-Za-z0-9_-]{32,}/g },
  { name: "github-pat", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "github-fine", re: /github_pat_[A-Za-z0-9_]{82}/g },
  { name: "aws-akid", re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "aws-secret", re: /\baws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi },
  { name: "google", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "slack", re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: "stripe", re: /\b(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}\b/g },
  {
    name: "private-key",
    re: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END[^-]*-----/g,
  },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: "bearer", re: /\b(?:Bearer|Authorization:?)\s+[A-Za-z0-9._~+/=-]{20,}/gi },
  {
    name: "env-secret",
    re: /\b(?:PASSWORD|SECRET|API[_-]?KEY|ACCESS[_-]?TOKEN|PRIVATE[_-]?KEY)\s*=\s*["']?[^\s"'\n]{8,}["']?/gi,
  },
];

export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re } of PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}
