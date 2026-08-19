export type GithubDispatchKind =
  | "outage"
  | "rate-limit"
  | "auth"
  | "forbidden"
  | "not-found"
  | "generic";

export interface GithubDispatch {
  kind: GithubDispatchKind;
  stamp: string;
  title: string;
  body: string;
}

const COPY: Record<GithubDispatchKind, Omit<GithubDispatch, "kind">> = {
  outage: {
    stamp: "OUTAGE",
    title: "Origin bureau unreachable",
    body: "GitHub is not answering this dispatch. Wait, then recanvass.",
  },
  "rate-limit": {
    stamp: "QUOTA",
    title: "Dispatch quota exhausted",
    body: "The origin bureau has sealed further requests. Retry after the window.",
  },
  auth: {
    stamp: "CLEARANCE",
    title: "Session expired",
    body: "Sign in again to continue this desk.",
  },
  forbidden: {
    stamp: "FORBIDDEN",
    title: "Desk sealed",
    body: "This installation cannot run that desk. Check app permissions or org SSO.",
  },
  "not-found": {
    stamp: "MISSING",
    title: "Record not on file",
    body: "That record is not on file at origin.",
  },
  generic: {
    stamp: "VARIANT",
    title: "Dispatch failed",
    body: "The origin bureau rejected this dispatch. Recanvass, or inspect the filing.",
  },
};

const LOCAL_MARKERS = [
  "SSH_IDENTITY_REQUIRED",
  "SSH_PASSPHRASE_REQUIRED",
  "VARIANT_DIVERGED",
  "FORCE_PUSH_REJECTED",
];

export function dispatchMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function classifyGithubDispatch(err: unknown): GithubDispatch | null {
  const text = dispatchMessage(err);
  if (!text || LOCAL_MARKERS.some((mark) => text.includes(mark))) return null;

  const kind = classifyKind(text);
  if (!kind) return null;
  return { kind, ...COPY[kind] };
}

export function isGithubDispatchError(err: unknown): boolean {
  return classifyGithubDispatch(err) != null;
}

export function isAuthError(err: unknown): boolean {
  return classifyGithubDispatch(err)?.kind === "auth";
}

function classifyKind(text: string): GithubDispatchKind | null {
  const prefix = prefixedKind(text);
  if (prefix) return prefix;

  const lower = text.toLowerCase();
  if (isOutageShape(text, lower)) return "outage";
  if (isRateLimitShape(text, lower)) return "rate-limit";
  if (isAuthShape(text, lower)) return "auth";
  if (isForbiddenShape(text, lower)) return "forbidden";
  if (isNotFoundShape(text, lower)) return "not-found";
  if (isGenericGithubShape(text, lower)) return "generic";
  return null;
}

function prefixedKind(text: string): GithubDispatchKind | null {
  if (text.startsWith("GITHUB_OUTAGE:") || text === "GITHUB_OUTAGE") return "outage";
  if (text.startsWith("GITHUB_RATE_LIMIT:") || text === "GITHUB_RATE_LIMIT") return "rate-limit";
  if (text.includes("GITHUB_AUTH_REQUIRED")) return "auth";
  if (text.startsWith("GITHUB_FORBIDDEN:") || text === "GITHUB_FORBIDDEN") return "forbidden";
  if (text.startsWith("GITHUB_NOT_FOUND:") || text === "GITHUB_NOT_FOUND") return "not-found";
  if (text.startsWith("GITHUB_DISPATCH:") || text === "GITHUB_DISPATCH") return "generic";
  return null;
}

function isOutageShape(text: string, lower: string): boolean {
  if (/GitHub API 50[0-4]\b/.test(text)) return true;
  if (/\b(500|502|503|504)\s+(Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/i.test(text)) {
    return true;
  }
  return (
    lower.includes("error sending request") ||
    lower.includes("error trying to connect") ||
    lower.includes("connection refused") ||
    lower.includes("timed out") ||
    lower.includes("dns error")
  );
}

function isRateLimitShape(text: string, lower: string): boolean {
  return /GitHub API 429\b/.test(text) || lower.includes("rate limit") || lower.includes("secondary rate");
}

function isAuthShape(text: string, lower: string): boolean {
  return (
    /GitHub API 401\b/.test(text) ||
    lower.includes("github rejected credentials") ||
    lower.includes("device login expired") ||
    lower.includes("a github token is required") ||
    lower.includes("bad credentials")
  );
}

function isForbiddenShape(text: string, lower: string): boolean {
  return (
    /GitHub API 403\b/.test(text) ||
    lower.includes("resource not accessible") ||
    lower.includes("sso")
  );
}

function isNotFoundShape(text: string, lower: string): boolean {
  return /GitHub API 404\b/.test(text) || lower.includes("not found");
}

function isGenericGithubShape(text: string, lower: string): boolean {
  return (
    text.includes("VARIANT DETECTED") ||
    lower.includes("github api") ||
    lower.includes("github graphql") ||
    lower.includes("github login") ||
    lower.includes("device flow is disabled") ||
    lower.includes("github app client id")
  );
}
