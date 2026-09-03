import { describe, expect, it } from "vitest";
import { EXHIBITS } from "./registry";

const FROZEN = [
  ["transmit-button", ["success", "loading", "empty"]],
  ["tva-skeleton", ["success"]],
  ["tva-jumble", ["success"]],
  ["tva-term", ["success"]],
  ["file-kind-icon", ["success"]],
  ["person-name", ["success"]],
  ["rail-strip", ["success"]],
  ["command-palette", ["success", "empty"]],
  ["title-bar", ["success", "empty"]],
  ["about-dialog", ["success"]],
  ["bureau-header", ["success", "loading", "empty"]],
  ["status-bar", ["success", "loading", "error", "empty"]],
  ["branch-picker", ["success", "loading", "error", "empty"]],
  ["welcome-gate", ["success", "loading", "error", "empty", "outage"]],
  ["sacred-timeline", ["success", "loading", "empty"]],
  ["variant-rail", ["success", "loading", "empty"]],
  ["history-rail", ["success", "empty"]],
  ["tags-rail", ["success", "empty"]],
  ["seal-desk", ["success", "loading", "empty"]],
  ["tva-context-menu", ["success"]],
  ["left-rail", ["success", "loading", "empty"]],
  ["docket", ["success", "loading", "empty"]],
  ["diff-viewer", ["success", "loading", "error", "empty"]],
  ["review-mode", ["success", "loading", "error", "empty"]],
  ["nexus-tooltip", ["success", "error", "empty"]],
  ["nexus-dossier", ["success", "loading", "error", "empty"]],
  ["auth-dialog", ["success", "loading", "error", "empty", "outage", "auth"]],
  ["identity-picker", ["success", "loading", "error", "empty"]],
  ["hq-mode", ["success", "loading", "error", "empty", "outage", "rate-limit", "auth", "forbidden"]],
  ["github-dispatch", ["success"]],
  ["hq-clearance", ["success"]],
  ["pr-compare", ["success", "loading", "error", "empty"]],
  ["settings-page", ["success", "loading", "error", "empty"]],
  ["github-sign-in", ["success", "loading", "error", "empty", "outage", "auth"]],
  ["github-requests", ["success", "loading", "error", "empty", "outage", "rate-limit", "auth", "forbidden"]],
  ["github-incidents", ["success", "loading", "error", "empty", "outage", "rate-limit", "auth", "forbidden"]],
  ["github-canon", ["success", "loading", "error", "empty", "outage", "rate-limit", "auth", "forbidden"]],
] as const;

describe("gallery exhibit freeze", () => {
  it("locks exhibit ids and stamp sets", () => {
    expect(EXHIBITS.map((e) => e.id)).toEqual(FROZEN.map(([id]) => id));
    for (const [id, stamps] of FROZEN) {
      const exhibit = EXHIBITS.find((item) => item.id === id);
      expect(exhibit?.stamps).toEqual([...stamps]);
    }
  });
});
