import { describe, expect, it } from "vitest";
import {
  classifyGithubDispatch,
  isAuthError,
  isGithubDispatchError,
} from "./githubDispatch";

describe("classifyGithubDispatch", () => {
  it.each([
    ["GITHUB_OUTAGE: Service Unavailable", "outage", "OUTAGE"],
    ["GITHUB_RATE_LIMIT: API rate limit exceeded", "rate-limit", "QUOTA"],
    ["GITHUB_AUTH_REQUIRED", "auth", "CLEARANCE"],
    ["GITHUB_FORBIDDEN: Resource not accessible by integration", "forbidden", "FORBIDDEN"],
    ["GITHUB_NOT_FOUND: Not Found", "not-found", "MISSING"],
    ["GITHUB_DISPATCH: GitHub API 422 Unprocessable Entity: Validation Failed", "generic", "VARIANT"],
  ] as const)("classifies prefix %s", (message, kind, stamp) => {
    const dispatch = classifyGithubDispatch(message);
    expect(dispatch?.kind).toBe(kind);
    expect(dispatch?.stamp).toBe(stamp);
  });

  it.each([
    ["GitHub API 503 Service Unavailable: {\"message\":\"Service Unavailable\"}", "outage"],
    ["error sending request for url (https://api.github.com/user)", "outage"],
    ["error trying to connect: tcp connect error", "outage"],
    ["GitHub API 429 Too Many Requests: {\"message\":\"API rate limit exceeded\"}", "rate-limit"],
    ["GitHub API 401 Unauthorized: {\"message\":\"Bad credentials\"}", "auth"],
    ["GitHub rejected credentials (401 Unauthorized)", "auth"],
    ["Device login expired.", "auth"],
    ["GitHub API 403 Forbidden: {\"message\":\"Resource not accessible by integration\"}", "forbidden"],
    ["GitHub GraphQL: Resource not accessible by integration", "forbidden"],
    ["GitHub API 404 Not Found: {\"message\":\"Not Found\"}", "not-found"],
    ["VARIANT DETECTED — specimen dispatch failed.", "generic"],
    ["GitHub login failed: bad_verification_code", "generic"],
  ] as const)("classifies leftover %s", (message, kind) => {
    expect(classifyGithubDispatch(message)?.kind).toBe(kind);
  });

  it("returns null for local git and SSH markers", () => {
    expect(classifyGithubDispatch("SSH_IDENTITY_REQUIRED")).toBeNull();
    expect(classifyGithubDispatch("VARIANT_DIVERGED: local branch and origin have diverged")).toBeNull();
    expect(classifyGithubDispatch("failed to stat path")).toBeNull();
  });

  it("treats Error objects the same as strings", () => {
    expect(classifyGithubDispatch(new Error("GITHUB_OUTAGE: down"))?.kind).toBe("outage");
  });
});

describe("github dispatch helpers", () => {
  it("detects auth and github-shaped errors", () => {
    expect(isAuthError("GITHUB_AUTH_REQUIRED")).toBe(true);
    expect(isAuthError("GITHUB_OUTAGE: down")).toBe(false);
    expect(isGithubDispatchError("GITHUB_OUTAGE: down")).toBe(true);
    expect(isGithubDispatchError("failed to stat path")).toBe(false);
  });
});
