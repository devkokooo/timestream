import { describe, expect, it } from "vitest";
import { pickSelectedRemote, remoteNameError, remoteUrlError } from "@/remotes/remoteName";

describe("remoteNameError", () => {
  it.each(["origin", "upstream", "mirror", "github"])("accepts %s", (name) => {
    expect(remoteNameError(name, [])).toBeNull();
  });

  it("rejects a name already taken unless it is the remote being renamed", () => {
    expect(remoteNameError("origin", ["origin", "upstream"])).toBe(
      "Remote 'origin' already exists.",
    );
    expect(remoteNameError("origin", ["origin", "upstream"], { renaming: "origin" })).toBeNull();
  });
});

describe("remoteUrlError", () => {
  it("requires a URL", () => {
    expect(remoteUrlError("")).toBe("URL is required.");
    expect(remoteUrlError("  ")).toBe("URL is required.");
    expect(remoteUrlError("git@github.com:acme/app.git")).toBeNull();
  });
});

describe("pickSelectedRemote", () => {
  it("keeps the current selection when it still exists", () => {
    expect(pickSelectedRemote(["origin", "upstream"], "upstream")).toBe("upstream");
  });

  it("defaults to origin, then the first remote", () => {
    expect(pickSelectedRemote(["upstream", "origin"], "gone")).toBe("origin");
    expect(pickSelectedRemote(["upstream", "mirror"], null)).toBe("upstream");
    expect(pickSelectedRemote([], "origin")).toBeNull();
  });
});
