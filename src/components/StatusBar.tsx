import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { AheadBehind, RemoteInfo, RepoSummary } from "../lib/types";

interface Props {
  repo: RepoSummary | null;
  origin: RemoteInfo | null;
  sync: AheadBehind | null;
  onBranchClick?: () => void;
  branchOpen?: boolean;
}

export function StatusBar({ repo, origin, sync, onBranchClick, branchOpen }: Props) {
  const detached = Boolean(repo) && !repo?.branch;
  const branch = repo?.branch ?? (repo ? "DETACHED" : null);
  const sha = repo?.head?.slice(0, 7) ?? null;
  const remote =
    origin?.owner && origin.nameOnHost ? `${origin.owner}/${origin.nameOnHost}` : null;

  return (
    <footer
      className="relative z-50 flex h-6 shrink-0 items-stretch border-t border-tva-gold/18 bg-[#1a1612] font-mono text-[11px] text-tva-paper-dim"
      aria-label="Status bar"
    >
      {branch ? (
        <StatusItem
          title={detached ? "Detached HEAD" : `Current branch: ${branch}`}
          onClick={onBranchClick}
          expanded={branchOpen}
          popup="dialog"
          className={detached ? "text-[#ff8a6a]" : "text-tva-gold-bright"}
        >
          <BranchMark />
          <span className="font-semibold tracking-[0.04em]">{branch}</span>
        </StatusItem>
      ) : (
        <StatusItem title="Open an archive to select a sequence">No archive</StatusItem>
      )}
      {repo ? (
        <StatusItem title="Ahead / behind origin">
          {sync ? `↑${sync.ahead} ↓${sync.behind}` : "↑— ↓—"}
        </StatusItem>
      ) : null}
      {sha ? (
        <StatusItem title="HEAD">{sha}</StatusItem>
      ) : null}
      <span className="min-w-0 flex-1" />
      {remote ? (
        <StatusItem title={remote} className="max-w-[40%] truncate text-tva-muted">
          {remote}
        </StatusItem>
      ) : repo ? (
        <StatusItem className="text-tva-muted">Local archive</StatusItem>
      ) : null}
    </footer>
  );
}

function StatusItem({
  children,
  title,
  onClick,
  expanded,
  popup,
  className,
}: {
  children: ReactNode;
  title?: string;
  onClick?: () => void;
  expanded?: boolean;
  popup?: "dialog" | "menu";
  className?: string;
}) {
  const shared = cn(
    "flex h-full items-center gap-1.5 px-2.5",
    onClick && "hover:bg-white/8",
    className,
  );
  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        className={cn(shared, "border-0 bg-transparent")}
        onClick={onClick}
        aria-expanded={expanded}
        aria-haspopup={popup}
      >
        {children}
      </button>
    );
  }
  return (
    <span title={title} className={shared}>
      {children}
    </span>
  );
}

function BranchMark() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="4" r="2" fill="currentColor" />
      <circle cx="4" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
      <path
        d="M4 6 V10 M4 8 C4 8 8 8 10 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
