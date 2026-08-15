import { describe, expect, it } from "vitest";
import { defaultSettings, searchSettings, SETTINGS_REGISTRY } from "./settingsRegistry";

describe("settings registry", () => {
  it("includes github, ssh, and timeline keys", () => {
    const keys = SETTINGS_REGISTRY.map((s) => s.key);
    expect(keys).toContain("github.clone_protocol");
    expect(keys).toContain("ssh.default_key");
    expect(keys).toContain("timeline.show_upstream_refs");
  });

  it("finds ssh key settings by github noun or flavor", () => {
    const hits = searchSettings("ssh key");
    expect(hits.some((h) => h.key === "ssh.default_key")).toBe(true);
    expect(searchSettings("identity").length).toBeGreaterThan(0);
  });

  it("toggles boolean settings without dropping other fields", () => {
    const def = SETTINGS_REGISTRY.find((s) => s.key === "ssh.agent_autostart")!;
    const next = def.set(defaultSettings(), false);
    expect(next.ssh.agentAutostart).toBe(false);
    expect(next.version).toBe(1);
  });
});
