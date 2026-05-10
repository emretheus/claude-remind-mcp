import { describe, expect, it } from "vitest";
import { classifySolved } from "./solved.js";

describe("classifySolved", () => {
  it("returns likely on positive sentiment", () => {
    expect(
      classifySolved({ hasError: false, endedCleanly: false, lastUserText: "thanks, that works!" }),
    ).toBe("likely");
  });

  it("returns likely on Turkish positive sentiment", () => {
    expect(
      classifySolved({ hasError: false, endedCleanly: false, lastUserText: "tamam çözüldü" }),
    ).toBe("likely");
  });

  it("returns unlikely on negative sentiment", () => {
    expect(
      classifySolved({ hasError: false, endedCleanly: true, lastUserText: "still broken" }),
    ).toBe("unlikely");
  });

  it("returns likely when ended cleanly and no error, no sentiment", () => {
    expect(classifySolved({ hasError: false, endedCleanly: true, lastUserText: null })).toBe(
      "likely",
    );
  });

  it("returns unknown for ambiguous tail messages", () => {
    expect(
      classifySolved({
        hasError: true,
        endedCleanly: false,
        lastUserText: "which container is it",
      }),
    ).toBe("unknown");
  });

  it("ignores meta tail messages like screenshots/interrupts", () => {
    expect(
      classifySolved({
        hasError: false,
        endedCleanly: false,
        lastUserText: "[Image: /tmp/x.png]",
      }),
    ).toBe("unknown");
    expect(
      classifySolved({
        hasError: false,
        endedCleanly: false,
        lastUserText: "[Request interrupted by user for tool use]",
      }),
    ).toBe("unknown");
  });

  it("returns unknown when lastUserText is null and no clean end", () => {
    expect(classifySolved({ hasError: true, endedCleanly: false, lastUserText: null })).toBe(
      "unknown",
    );
  });
});
