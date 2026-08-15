import { cn } from "../lib/cn";
import { btn, btnPrimary, eyebrow } from "../lib/ui";
import type { RepoSummary } from "../lib/types";

interface Props {
  repo: RepoSummary;
  onOpen: () => void;
  onReload: () => void;
}

export function BureauHeader({ repo, onOpen, onReload }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-tva-gold/22 bg-linear-to-b from-[#2a231c] to-[#1a1612] px-[18px] py-2.5">
      <div className="flex items-center gap-3">
        <svg className="size-[42px]" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="28" fill="#2b2118" stroke="#e85d04" strokeWidth="3" />
          <path d="M10 32 H54" stroke="#f4c430" strokeWidth="3" />
          <path d="M32 32 C 40 18, 50 18, 56 24" fill="none" stroke="#e85d04" strokeWidth="2.4" />
          <circle cx="32" cy="32" r="4" fill="#f4c430" />
        </svg>
        <div>
          <p className={eyebrow}>Time Variance Authority</p>
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[0.18em]">TIMESTREAM</h1>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 font-mono text-[11px] text-tva-paper-dim">
        <span>CHRONOMONITORING DIVISION</span>
        <span>
          FILE {repo.name.toUpperCase()} · {repo.branch ?? "DETACHED"} ·{" "}
          {repo.head?.slice(0, 7) ?? "—"}
        </span>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={onReload}>
          Rescan
        </button>
        <button type="button" className={cn(btn, btnPrimary)} onClick={onOpen}>
          Open archive
        </button>
      </div>
    </header>
  );
}
