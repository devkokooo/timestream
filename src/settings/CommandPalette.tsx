import { useEffect, useMemo, useState } from "react";
import { searchSettings, type SettingDef } from "@/settings/settingsRegistry";
import { fieldInput } from "@/ui/ui";
import type { AppSettings } from "@/settings/types";

export interface PaletteCommand {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  commands: PaletteCommand[];
  settings: AppSettings;
  onClose: () => void;
  onOpenSetting: (key: string, query: string) => void;
  onToggleSetting: (def: SettingDef) => void;
}

export function CommandPalette({
  open,
  commands,
  settings,
  onClose,
  onOpenSetting,
  onToggleSetting,
}: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const settingHits = useMemo(() => searchSettings(query), [query]);
  const commandHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.title} ${c.hint ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  const rows: Array<{ kind: "command"; command: PaletteCommand } | { kind: "setting"; def: SettingDef }> = [
    ...commandHits.map((command) => ({ kind: "command" as const, command })),
    ...settingHits.map((def) => ({ kind: "setting" as const, def })),
  ];

  useEffect(() => {
    if (!open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;
  const current = rows[index];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/45 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(640px,92vw)] overflow-hidden border border-tva-gold/30 bg-[#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <input
          className={`${fieldInput} rounded-none border-0 border-b border-tva-gold/20`}
          value={query}
          autoFocus
          placeholder="Run a command or search settings"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(rows.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && current) {
              e.preventDefault();
              if (current.kind === "command") {
                current.command.run();
                onClose();
              } else if (current.def.kind === "boolean") {
                onToggleSetting(current.def);
              } else {
                onOpenSetting(current.def.key, query);
                onClose();
              }
            }
          }}
        />
        <ul className="m-0 max-h-[50vh] list-none overflow-auto p-0">
          {rows.map((row, i) => (
            <li key={row.kind === "command" ? row.command.id : row.def.key}>
              <button
                type="button"
                className={`flex w-full items-center justify-between border-0 px-3 py-2 text-left text-sm ${
                  i === index ? "bg-tva-orange/16 text-tva-paper" : "bg-transparent text-tva-paper-dim"
                }`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  if (row.kind === "command") {
                    row.command.run();
                    onClose();
                  } else if (row.def.kind === "boolean") {
                    onToggleSetting(row.def);
                  } else {
                    onOpenSetting(row.def.key, query);
                    onClose();
                  }
                }}
              >
                {row.kind === "command" ? (
                  <>
                    <span>{row.command.title}</span>
                    {row.command.hint ? (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-tva-muted">
                        {row.command.hint}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span>
                      {row.def.title}
                      <span className="ml-2 font-mono text-[10px] text-tva-muted">{row.def.key}</span>
                    </span>
                    {row.def.kind === "boolean" ? (
                      <span className="text-[11px] text-tva-gold">
                        {row.def.get(settings) ? "✓" : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-tva-muted">Setting</span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
        <footer className="border-t border-tva-gold/16 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-tva-muted">
          Ctrl+Shift+P · Command palette
        </footer>
      </div>
    </div>
  );
}
