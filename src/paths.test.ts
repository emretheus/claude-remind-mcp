import { afterEach, describe, expect, it } from "vitest";
import { claudeConfigDir, encodeProjectFolder, projectsDir, remindDataDir } from "./paths.js";

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_CONFIG = process.env.CLAUDE_CONFIG_DIR;
const ORIGINAL_REMIND = process.env.CLAUDE_REMIND_DIR;

afterEach(() => {
  if (ORIGINAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = ORIGINAL_HOME;
  if (ORIGINAL_CONFIG === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CONFIG;
  if (ORIGINAL_REMIND === undefined) delete process.env.CLAUDE_REMIND_DIR;
  else process.env.CLAUDE_REMIND_DIR = ORIGINAL_REMIND;
});

describe("paths", () => {
  it("respects CLAUDE_CONFIG_DIR override", () => {
    process.env.CLAUDE_CONFIG_DIR = "/tmp/fake-claude";
    expect(claudeConfigDir()).toBe("/tmp/fake-claude");
    expect(projectsDir()).toBe("/tmp/fake-claude/projects");
  });

  it("respects CLAUDE_REMIND_DIR override", () => {
    process.env.CLAUDE_REMIND_DIR = "/tmp/fake-remind";
    expect(remindDataDir()).toBe("/tmp/fake-remind");
  });

  it("encodeProjectFolder replaces slashes with hyphens", () => {
    expect(encodeProjectFolder("/Users/me/repo")).toBe("-Users-me-repo");
  });
});
