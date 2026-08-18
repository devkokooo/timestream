export const CORE_SCENARIOS = ["success", "loading", "error", "empty"] as const;
export const GITHUB_FAIL_SCENARIOS = ["outage", "rate-limit", "auth", "forbidden"] as const;
export const SCENARIOS = [...CORE_SCENARIOS, ...GITHUB_FAIL_SCENARIOS] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_STAMP: Record<Scenario, string> = {
  success: "SUCCESS",
  loading: "LOADING",
  error: "ERROR",
  empty: "EMPTY",
  outage: "OUTAGE",
  "rate-limit": "QUOTA",
  auth: "CLEARANCE",
  forbidden: "FORBIDDEN",
};

let scenario: Scenario = "success";
const listeners = new Set<() => void>();

export function getScenario(): Scenario {
  return scenario;
}

export function setScenario(next: Scenario): void {
  if (scenario === next) return;
  scenario = next;
  listeners.forEach((fn) => fn());
}

export function subscribeScenario(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isScenario(value: string): value is Scenario {
  return (SCENARIOS as readonly string[]).includes(value);
}

export function neverResolves<T>(): Promise<T> {
  return new Promise(() => {});
}

export const SPECIMEN_ERROR = "VARIANT DETECTED — specimen dispatch failed.";
export const SPECIMEN_OUTAGE = "GITHUB_OUTAGE: Service Unavailable";
export const SPECIMEN_RATE_LIMIT = "GITHUB_RATE_LIMIT: API rate limit exceeded";
export const SPECIMEN_AUTH = "GITHUB_AUTH_REQUIRED";
export const SPECIMEN_FORBIDDEN = "GITHUB_FORBIDDEN: Resource not accessible by integration";
export const SPECIMEN_NOT_FOUND = "GITHUB_NOT_FOUND: Not Found";

export const DISPATCH_SPECIMENS = [
  SPECIMEN_OUTAGE,
  SPECIMEN_RATE_LIMIT,
  SPECIMEN_AUTH,
  SPECIMEN_FORBIDDEN,
  SPECIMEN_NOT_FOUND,
  SPECIMEN_ERROR,
] as const;
