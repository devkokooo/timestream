import { describe, expect, it } from "vitest";
import { branchNameError, isValidBranchName } from "@/branches/branchName";

describe("branchNameError", () => {
  it.each(["main", "feature/foo", "v1.2", "hotfix-12", "user/name_ok"])(
    "accepts %s",
    (name) => {
      expect(branchNameError(name, [])).toBeNull();
      expect(isValidBranchName(name)).toBe(true);
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
    expect(branchNameError(name, [])).toBe(message);
    expect(isValidBranchName(name)).toBe(false);
  });

  it("rejects a name already taken unless it is the branch being renamed", () => {
    expect(branchNameError("main", ["main", "feature"])).toBe("Variant 'main' already exists.");
    expect(branchNameError("main", ["main", "feature"], { renaming: "main" })).toBeNull();
    expect(branchNameError("feature", ["main", "feature"], { renaming: "main" })).toBe(
      "Variant 'feature' already exists.",
    );
  });
});
