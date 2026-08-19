import { describe, expect, it } from "vitest";
import { cloneUrl, errMessage, keepIfSame, sameJson } from "./helpers";

describe("cloneUrl", () => {
  it.each([
    ["https://github.com/tva/timestream", "ssh", "git@github.com:tva/timestream.git"],
    ["https://github.com/tva/timestream.git", "ssh", "git@github.com:tva/timestream.git"],
    ["https://github.com/tva/timestream/", "https", "https://github.com/tva/timestream/"],
    ["git@github.com:tva/timestream.git", "https", "git@github.com:tva/timestream.git"],
    ["tva/timestream", "ssh", "git@github.com:tva/timestream.git"],
    ["tva/timestream", "https", "https://github.com/tva/timestream.git"],
    ["https://gitlab.com/x/y.git", "ssh", "https://gitlab.com/x/y.git"],
    ["not-a-repo", "ssh", "not-a-repo"],
  ] as const)("%s via %s → %s", (input, protocol, expected) => {
    expect(cloneUrl(input, protocol)).toBe(expected);
  });
});

describe("sameJson", () => {
  it("keeps the previous reference when values match", () => {
    const prev = { a: 1 };
    expect(keepIfSame(prev, { a: 1 })).toBe(prev);
    expect(sameJson(prev, { a: 1 })).toBe(true);
  });
});

describe("errMessage", () => {
  it("reads Error.message", () => {
    expect(errMessage(new Error("sealed"))).toBe("sealed");
    expect(errMessage("plain")).toBe("plain");
  });
});
