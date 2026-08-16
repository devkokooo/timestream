import { describe, expect, it } from "vitest";
import { identityEmails, isSelfEmail, isSelfLogin, isSelfPerson, normalizeEmail } from "./githubIdentity";
import type { GithubUser } from "./types";

function user(partial: Partial<GithubUser> = {}): GithubUser {
  return {
    login: "octocat",
    name: "The Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    email: "octocat@github.com",
    emails: ["octocat@github.com", "octocat@users.noreply.github.com"],
    ...partial,
  };
}

describe("githubIdentity", () => {
  it("normalizes email case and space", () => {
    expect(normalizeEmail("  OctoCat@GitHub.COM ")).toBe("octocat@github.com");
  });

  it("includes public, listed, and noreply emails", () => {
    expect(identityEmails(user({ emails: ["work@tva.local"] }))).toEqual([
      "octocat@github.com",
      "work@tva.local",
      "octocat@users.noreply.github.com",
    ]);
  });

  it("matches commit emails against the signed-in identity", () => {
    const me = user();
    expect(isSelfEmail(me, "octocat@github.com")).toBe(true);
    expect(isSelfEmail(me, "OCTOCAT@users.noreply.github.com")).toBe(true);
    expect(isSelfEmail(me, "other@tva.local")).toBe(false);
    expect(isSelfEmail(null, "octocat@github.com")).toBe(false);
  });

  it("matches GitHub logins on requests and incidents", () => {
    const me = user();
    expect(isSelfLogin(me, "octocat")).toBe(true);
    expect(isSelfLogin(me, "Octocat")).toBe(true);
    expect(isSelfLogin(me, "analyst")).toBe(false);
    expect(isSelfPerson(me, { login: "octocat" })).toBe(true);
    expect(isSelfPerson(me, { email: "work@tva.local" })).toBe(false);
  });
});
