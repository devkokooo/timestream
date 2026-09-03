import { describe, expect, it } from "vitest";
import { isValidTagName, tagNameError } from "@/timeline/tagName";

describe("tagNameError", () => {
  it.each(["v1.0.0", "release/2024", "canon", "hotfix-12", "user/name_ok"])(
    "accepts %s",
    (name) => {
      expect(tagNameError(name, [])).toBeNull();
      expect(isValidTagName(name)).toBe(true);
    },
  );

  it.each([
    ["", "Name is required."],
    ["   ", "Name is required."],
    ["HEAD", "HEAD is reserved."],
    ["head", "HEAD is reserved."],
    ["-oops", "Name cannot start with '-'."],
    ["foo..bar", "Name cannot contain '..'."],
    ["foo@{bar", "Name cannot contain '@{'."],
    ["@", "Name cannot be '@'."],
    ["/foo", "Name cannot start, end, or repeat '/'."],
    ["foo/", "Name cannot start, end, or repeat '/'."],
    ["foo//bar", "Name cannot start, end, or repeat '/'."],
    ["foo.", "Name cannot end with a dot."],
    ["foo bar", "Name contains an illegal character."],
    ["foo~bar", "Name contains an illegal character."],
    [".hidden", "A path segment cannot start with a dot."],
    ["feat/.hidden", "A path segment cannot start with a dot."],
    ["release.lock", "A path segment cannot end with '.lock'."],
    ["feat.lock/x", "A path segment cannot end with '.lock'."],
  ])("rejects %s", (name, message) => {
    expect(tagNameError(name, [])).toBe(message);
    expect(isValidTagName(name)).toBe(false);
  });

  it("rejects a name already taken", () => {
    expect(tagNameError("v1.0.0", ["v1.0.0", "v2"])).toBe("Seal 'v1.0.0' already exists.");
    expect(tagNameError("v3", ["v1.0.0", "v2"])).toBeNull();
  });
});
