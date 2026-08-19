import { describe, expect, it } from "vitest";
import { parseCommitBody, parsePerson, roleForKey } from "@/timeline/commitTrailers";

describe("roleForKey", () => {
  it("maps the usual attestation keys", () => {
    expect(roleForKey("Co-authored-by")).toBe("coauthor");
    expect(roleForKey("Signed-off-by")).toBe("signer");
    expect(roleForKey("Reviewed-by")).toBe("reviewer");
    expect(roleForKey("Acked-by")).toBe("reviewer");
    expect(roleForKey("Tested-by")).toBe("tester");
    expect(roleForKey("Reported-by")).toBe("other");
    expect(roleForKey("Cc")).toBe("other");
  });

  it("ignores prose that only happens to contain a colon", () => {
    expect(roleForKey("Note")).toBeNull();
    expect(roleForKey("Warning")).toBeNull();
  });
});

describe("parsePerson", () => {
  it("reads a git identity", () => {
    expect(parsePerson("Mobius M. Mobius <mobius@tva.local>")).toEqual({
      name: "Mobius M. Mobius",
      email: "mobius@tva.local",
    });
  });

  it("keeps a bare email", () => {
    expect(parsePerson("analyst@tva.local")).toEqual({
      name: "analyst@tva.local",
      email: "analyst@tva.local",
    });
  });
});

describe("parseCommitBody", () => {
  it("returns the whole body as narrative when there are no trailers", () => {
    const parsed = parseCommitBody("Prune the leftover variant.\n\nKeep the river gold.");
    expect(parsed.narrative).toBe("Prune the leftover variant.\n\nKeep the river gold.");
    expect(parsed.trailers).toEqual([]);
  });

  it("splits a trailing attestation block from the description", () => {
    const parsed = parseCommitBody(
      [
        "File the spur onto the sacred river.",
        "",
        "More notes for the analysts.",
        "",
        "Co-authored-by: B-15 <b15@tva.local>",
        "Signed-off-by: Mobius <mobius@tva.local>",
        "Reviewed-by: Ravonna <ravonna@tva.local>",
        "Tested-by: Casey <casey@tva.local>",
        "Reported-by: Hunter <hunter@tva.local>",
      ].join("\n"),
    );
    expect(parsed.narrative).toBe("File the spur onto the sacred river.\n\nMore notes for the analysts.");
    expect(parsed.coauthors.map((t) => t.name)).toEqual(["B-15"]);
    expect(parsed.signers.map((t) => t.email)).toEqual(["mobius@tva.local"]);
    expect(parsed.reviewers.map((t) => t.name)).toEqual(["Ravonna"]);
    expect(parsed.testers.map((t) => t.name)).toEqual(["Casey"]);
    expect(parsed.others.map((t) => t.name)).toEqual(["Hunter"]);
  });

  it("does not treat a mid-body colon line as a trailer", () => {
    const parsed = parseCommitBody("Warning: do not prune the sacred lane.\n\nKeep the fiber.");
    expect(parsed.narrative).toContain("Warning: do not prune");
    expect(parsed.trailers).toEqual([]);
  });

  it("treats a body that is only trailers as empty narrative", () => {
    const parsed = parseCommitBody("Signed-off-by: Analyst <analyst@tva.local>");
    expect(parsed.narrative).toBe("");
    expect(parsed.signers).toHaveLength(1);
  });
});
