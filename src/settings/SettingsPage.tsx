import { useMemo, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { setSettings, settingsTomlPath } from "@/settings/api";
import { pickSshKey, sshAddKey, sshAgentEnsure } from "@/ssh/api";
import { searchSettings, type SettingDef } from "@/settings/settingsRegistry";
import { btn, btnPrimary, fieldInput, panelTitle } from "@/ui/ui";
import type { AppSettings } from "@/settings/types";
import { TvaTerm } from "@/ui/TvaTerm";
import { TvaScrollArea } from "@/ui/TvaScrollArea";

interface Props {
  open: boolean;
  settings: AppSettings;
  focusKey?: string | null;
  filter?: string;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

const CATEGORIES = ["GitHub", "SSH", "Timeline", "Appearance"] as const;

export function SettingsPage({ open, settings, focusKey, filter, onClose, onChange }: Props) {
  const [query, setQuery] = useState(filter ?? "");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("GitHub");
  const matches = useMemo(() => searchSettings(query), [query]);
  const visible = matches.filter((item) => (query ? true : item.category === category));

  if (!open) return null;

  async function patch(def: SettingDef, value: string | boolean | null) {
    const next = await setSettings(def.set(settings, value));
    onChange(next);
  }

  return (
    <div className="fixed inset-x-0 top-9 bottom-6 z-40 flex flex-col bg-[#161310]">
      <header className="flex items-center justify-between gap-4 border-b border-tva-gold/22 px-5 py-3">
        <h1 className={panelTitle}>
          <TvaTerm flavor="Bureau settings" noun="Settings" />
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              const path = await settingsTomlPath();
              await openPath(path);
            }}
          >
            Open settings.toml
          </button>
          <button type="button" className={btnPrimary} onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="w-48 shrink-0 border-r border-tva-gold/16 p-3">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`mb-1 block w-full border-0 px-2 py-2 text-left text-xs uppercase tracking-[0.12em] ${
                category === item ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"
              }`}
              onClick={() => {
                setCategory(item);
                setQuery("");
              }}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-tva-gold/12 px-4 py-3">
            <input
              className={fieldInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              autoFocus
            />
          </div>
          <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-5 py-4">
            {visible.length === 0 ? (
              <p className="text-xs text-tva-muted">No settings match.</p>
            ) : (
              visible.map((item) => (
                <SettingRow
                  key={item.key}
                  def={item}
                  settings={settings}
                  focused={focusKey === item.key}
                  onPatch={patch}
                />
              ))
            )}
            {category === "SSH" && !query ? <SshActions settings={settings} /> : null}
          </TvaScrollArea>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  def,
  settings,
  focused,
  onPatch,
}: {
  def: SettingDef;
  settings: AppSettings;
  focused: boolean;
  onPatch: (def: SettingDef, value: string | boolean | null) => void;
}) {
  const value = def.get(settings);
  return (
    <div
      className={`mb-4 border-b border-tva-gold/12 pb-4 ${focused ? "bg-tva-orange/10 px-2 py-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-sm text-tva-paper">{def.title}</p>
          {def.flavor ? <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-tva-gold">{def.flavor}</p> : null}
          <p className="mt-1 mb-1 text-xs text-tva-paper-dim">{def.description}</p>
          <p className="m-0 font-mono text-[10px] text-tva-muted">{def.key}</p>
        </div>
        {def.kind === "boolean" ? (
          <button type="button" className={btn} onClick={() => onPatch(def, !value)}>
            {value ? "On" : "Off"}
          </button>
        ) : null}
        {def.kind === "select" ? (
          <select
            className={fieldInput}
            value={String(value ?? "")}
            onChange={(e) => onPatch(def, e.target.value)}
          >
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {def.kind === "path" ? (
          <button
            type="button"
            className={btn}
            onClick={async () => {
              const picked = await pickSshKey();
              if (picked) onPatch(def, picked.replaceAll("\\", "/"));
            }}
          >
            {value ? String(value).split("/").pop() : "Choose…"}
          </button>
        ) : null}
      </div>
      {def.key === "ssh.bindings" && settings.ssh.bindings.length > 0 ? (
        <ul className="mt-2 list-none p-0 text-[11px] text-tva-muted">
          {settings.ssh.bindings.map((b) => (
            <li key={`${b.repo}-${b.remote}`}>
              {b.remote} · {b.repo} → {b.key}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SshActions({ settings }: { settings: AppSettings }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={() => void sshAgentEnsure()}>
        <TvaTerm flavor="Start agent" noun="Start ssh-agent" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          const key = settings.ssh.defaultKey;
          if (key) await sshAddKey(key);
        }}
        disabled={!settings.ssh.defaultKey}
      >
        <TvaTerm flavor="Add key to agent" noun="ssh-add default key" />
      </button>
    </div>
  );
}
