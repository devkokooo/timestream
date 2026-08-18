export const SCENARIOS = ["success", "loading", "error", "empty"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_STAMP: Record<Scenario, string> = {
  success: "SUCCESS",
  loading: "LOADING",
  error: "ERROR",
  empty: "EMPTY",
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
