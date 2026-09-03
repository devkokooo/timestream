import { getName, getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState, version as reactVersion, type ReactNode } from "react";
import { SiDiscord, SiGithub } from "react-icons/si";
import { GiScrollUnfurled } from "react-icons/gi";
import {
  DISCORD_HREF,
  GITHUB_REPO,
  GIT2_LABEL,
  LICENSE_HREF,
  LICENSE_LABEL,
  SUPPORT_HREF,
  resolveAppVersion,
} from "@/shell/about";
import { cn } from "@/ui/cn";
import { TvaTerm } from "@/ui/TvaTerm";
import { btn, btnPrimary, fieldLabel, panelTitle } from "@/ui/ui";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RuntimeInfo {
  name: string;
  version: string;
  tauri: string;
}

const FALLBACK: RuntimeInfo = {
  name: "Timestream",
  version: "—",
  tauri: "—",
};

export function AboutDialog({ open, onClose }: Props) {
  const [info, setInfo] = useState<RuntimeInfo>(FALLBACK);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [name, runtimeVersion, tauri] = await Promise.all([
          getName(),
          getVersion(),
          getTauriVersion(),
        ]);
        if (!cancelled) {
          setInfo({ name, version: resolveAppVersion(runtimeVersion), tauri });
        }
      } catch {
        if (!cancelled) setInfo(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Version", value: info.version },
    { label: "Tauri", value: info.tauri },
    { label: "React", value: reactVersion },
    { label: "Git", value: GIT2_LABEL },
    { label: "License", value: LICENSE_LABEL },
  ];

  const links: Array<{ label: string; href: string; icon?: ReactNode }> = [
    { label: "Repository", href: GITHUB_REPO, icon: <SiGithub size={14} aria-hidden /> },
    { label: "Issues", href: SUPPORT_HREF, icon: <SiGithub size={14} aria-hidden /> },
    { label: "License", href: LICENSE_HREF, icon: <GiScrollUnfurled size={14} aria-hidden /> },
    { label: "Discord", href: DISCORD_HREF, icon: <SiDiscord size={14} aria-hidden /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        className="w-[min(440px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <h2 id="about-dialog-title" className={panelTitle}>
          <TvaTerm flavor="Bureau" noun={`About ${info.name}`} />
        </h2>

        <dl className="mt-5 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className={fieldLabel}>{row.label}</dt>
              <dd className="m-0 text-right font-mono text-[11px] text-tva-paper">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              className={cn(btn, "inline-flex items-center justify-center gap-2")}
              onClick={() => void openUrl(link.href)}
            >
              {link.icon}
              {link.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className={btnPrimary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
