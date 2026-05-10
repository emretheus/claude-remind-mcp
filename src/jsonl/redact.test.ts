import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("redacts OpenAI API keys", () => {
    expect(redactSecrets("key=sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890123456")).toContain(
      "[REDACTED]",
    );
    expect(redactSecrets("key=sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890123456")).not.toContain(
      "sk-proj-AbCd",
    );
  });

  it("redacts Anthropic API keys", () => {
    expect(redactSecrets("ANTHROPIC=sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx1234567890")).toContain(
      "[REDACTED]",
    );
  });

  it("redacts GitHub tokens", () => {
    expect(redactSecrets("token=ghp_1234567890abcdefghijklmnopqrstuvwxyz12")).toContain(
      "[REDACTED]",
    );
    expect(redactSecrets("token=ghs_1234567890abcdefghijklmnopqrstuvwxyz12")).toContain(
      "[REDACTED]",
    );
  });

  it("redacts AWS access keys", () => {
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe("[REDACTED]");
    expect(redactSecrets("ASIAQ3EGRTPUL5KKAOVH")).toBe("[REDACTED]");
  });

  it("redacts JWTs", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactSecrets(jwt)).toBe("[REDACTED]");
  });

  it("redacts BEGIN PRIVATE KEY blocks", () => {
    const key =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(key)).toBe("[REDACTED]");
  });

  it("redacts env-style PASSWORD/SECRET assignments", () => {
    expect(redactSecrets('PASSWORD="hunter2hunter2"')).toContain("[REDACTED]");
    expect(redactSecrets("API_KEY=mysecretvalue123")).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer abcdefghij1234567890xyz")).toContain("[REDACTED]");
  });

  it("preserves benign text", () => {
    expect(redactSecrets("hello world this is a normal message")).toBe(
      "hello world this is a normal message",
    );
  });

  it("preserves short strings that look like keys but are not", () => {
    expect(redactSecrets("AKIA shortkey")).toBe("AKIA shortkey");
  });
});
