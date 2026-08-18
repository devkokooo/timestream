import { isScenario, type Scenario } from "./scenario";

export interface DeskRoute {
  exhibit: string;
  scenario: Scenario;
}

export function readHash(fallback: DeskRoute): DeskRoute {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [exhibit, stamp] = raw.split("/");
  if (!exhibit) return fallback;
  return {
    exhibit,
    scenario: stamp && isScenario(stamp) ? stamp : fallback.scenario,
  };
}

export function writeHash(route: DeskRoute): void {
  const next = `#/${route.exhibit}/${route.scenario}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}
