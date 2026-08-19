import { SiGithub } from "react-icons/si";
import { cn } from "@/ui/cn";
import { btn, btnPrimary, eyebrow } from "@/ui/ui";
import { HintMark, TvaTerm } from "@/ui/TvaTerm";
import type { ForgeUser } from "@/auth/types";
import type { RemoteInfo } from "@/remotes/types";
import type { RepoSummary } from "@/git/types";

interface Props {
  repo: RepoSummary;
  origin: RemoteInfo | null;
  anomalyCount: number;
  anomalyLoading: boolean;
  reviewOpen: boolean;
  onToggleReview: () => void;
  user: ForgeUser | null;
  hqOpen: boolean;
  onToggleHq: () => void;
}

export function BureauHeader({
  repo,
  origin,
  anomalyCount,
  anomalyLoading,
  reviewOpen,
  onToggleReview,
  user,
  hqOpen,
  onToggleHq,
}: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-tva-gold/22 bg-linear-to-b from-[#2a231c] to-[#1a1612] px-4.5 py-2.5">
      <div className="flex items-center gap-3">
        <img
          className="size-10.5"
          src="/timestream-logo.svg"
          alt=""
          aria-hidden
          draggable={false}
        />
        <div>
          <p className={eyebrow}>Time Variance Authority</p>
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[0.18em]">TIMESTREAM</h1>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-1 font-mono text-[11px] text-tva-paper-dim">
        <span>CHRONOMONITORING DIVISION</span>
        <span className="max-w-105 overflow-hidden text-ellipsis whitespace-nowrap">
          FILE {repo.name.toUpperCase()}
          {origin?.owner && origin.nameOnHost ? ` · ${origin.owner}/${origin.nameOnHost}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={reviewOpen || anomalyCount > 0 ? btnPrimary : btn}
          onClick={onToggleReview}
          aria-pressed={reviewOpen}
          title="Review unfiled and filed records"
        >
          <TvaTerm
            flavor={
              anomalyLoading ? "Scanning" : anomalyCount ? `${anomalyCount} detected` : "Sequence stable"
            }
            noun="Anomalies"
            onPrimary={reviewOpen || anomalyCount > 0}
          />
        </button>
        <button
          type="button"
          className={cn(hqOpen ? btnPrimary : btn, "inline-flex items-center gap-2")}
          onClick={onToggleHq}
          aria-pressed={hqOpen}
          title="Pull requests, issues, and releases"
        >
          <SiGithub size={14} aria-hidden />
          <TvaTerm
            flavor={user ? `@${user.login}` : "GitHub"}
            noun="HQ desk"
            onPrimary={hqOpen}
          />
        </button>
        <HintMark label="Sacred Timeline is the default branch graph. Dispatch, pull, and push live on the review desk. HQ desk holds GitHub requests, incidents, and canon." />
      </div>
    </header>
  );
}
