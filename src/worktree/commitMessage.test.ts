import { describe, expect, it } from "vitest";
import { composeCommitMessage } from "@/worktree/commitMessage";

describe("composeCommitMessage", () => {
  it("returns a trimmed subject when the body is empty", () => {
    expect(composeCommitMessage("  File the spur  ", "  \n  ")).toBe("File the spur");
  });

  it("joins subject and body with a blank line", () => {
    expect(composeCommitMessage("File the spur", "Prune the leftover variant.")).toBe(
      "File the spur\n\nPrune the leftover variant.",
    );
  });

  it("collapses subject whitespace and trims a trailing body", () => {
    expect(composeCommitMessage("File   the\tspur", "Note.  \n")).toBe("File the spur\n\nNote.");
  });

  it("returns only the body when the subject is blank", () => {
    expect(composeCommitMessage("   ", "Keep the note")).toBe("Keep the note");
  });
});
