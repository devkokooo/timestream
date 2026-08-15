import type { AppSettings } from "./types";

export type SettingKind = "boolean" | "select" | "text" | "path";

export interface SettingDef {
  key: string;
  title: string;
  description: string;
  flavor?: string;
  category: "GitHub" | "SSH" | "Timeline" | "Appearance";
  kind: SettingKind;
  options?: { value: string; label: string }[];
  get: (settings: AppSettings) => string | boolean | null;
  set: (settings: AppSettings, value: string | boolean | null) => AppSettings;
}

export const SETTINGS_REGISTRY: SettingDef[] = [
  {
    key: "github.clone_protocol",
    title: "Clone protocol",
    flavor: "Archive protocol",
    description: "Use HTTPS or SSH when cloning a GitHub repository.",
    category: "GitHub",
    kind: "select",
    options: [
      { value: "https", label: "HTTPS" },
      { value: "ssh", label: "SSH" },
    ],
    get: (s) => s.github.cloneProtocol,
    set: (s, value) => ({
      ...s,
      github: { ...s.github, cloneProtocol: String(value ?? "https") },
    }),
  },
  {
    key: "ssh.agent_autostart",
    title: "Start SSH agent automatically",
    flavor: "Agent autostart",
    description: "Start the OpenSSH agent when a push or fetch needs a key.",
    category: "SSH",
    kind: "boolean",
    get: (s) => s.ssh.agentAutostart,
    set: (s, value) => ({
      ...s,
      ssh: { ...s.ssh, agentAutostart: Boolean(value) },
    }),
  },
  {
    key: "ssh.default_key",
    title: "Default SSH key",
    flavor: "Identity",
    description: "SSH key path used for github.com when no per-remote binding exists.",
    category: "SSH",
    kind: "path",
    get: (s) => s.ssh.defaultKey,
    set: (s, value) => ({
      ...s,
      ssh: { ...s.ssh, defaultKey: value ? String(value) : null },
    }),
  },
  {
    key: "ssh.bindings",
    title: "Per-remote SSH keys",
    flavor: "Identity bindings",
    description: "Remember which SSH key to use for a repository remote.",
    category: "SSH",
    kind: "text",
    get: (s) =>
      s.ssh.bindings.map((b) => `${b.remote} @ ${b.repo} → ${b.key}`).join("; "),
    set: (s) => s,
  },
  {
    key: "timeline.show_upstream_refs",
    title: "Show upstream refs",
    flavor: "Upstream spurs",
    description: "Draw remote-tracking branches on the Sacred Timeline.",
    category: "Timeline",
    kind: "boolean",
    get: (s) => s.timeline.showUpstreamRefs,
    set: (s, value) => ({
      ...s,
      timeline: { ...s.timeline, showUpstreamRefs: Boolean(value) },
    }),
  },
];

export function searchSettings(query: string): SettingDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return SETTINGS_REGISTRY;
  return SETTINGS_REGISTRY.filter((item) => {
    const hay = [item.key, item.title, item.description, item.flavor, item.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function defaultSettings(): AppSettings {
  return {
    version: 1,
    github: { cloneProtocol: "https" },
    ssh: { agentAutostart: true, defaultKey: null, bindings: [], identities: [] },
    timeline: { showUpstreamRefs: true },
  };
}
