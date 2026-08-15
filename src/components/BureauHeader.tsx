import { btn, btnPrimary, eyebrow } from "../lib/ui";
import { HintMark, TvaTerm } from "./TvaTerm";
import type { RemoteInfo, RepoSummary } from "../lib/types";

interface Props {
  repo: RepoSummary;
  origin: RemoteInfo | null;
  anomalyCount: number;
  anomalyLoading: boolean;
  reviewOpen: boolean;
  onToggleReview: () => void;
}

export function BureauHeader({
  repo,
  origin,
  anomalyCount,
  anomalyLoading,
  reviewOpen,
  onToggleReview,
}: Props) {
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
      <div className="flex min-w-0 flex-col items-end gap-1 font-mono text-[11px] text-tva-paper-dim">
        <span>CHRONOMONITORING DIVISION</span>
        <span className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap">
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
        <HintMark label="Sacred Timeline is the default branch graph. Dispatch, pull, and push live on the review desk." />
      </div>
    </header>
  );
}
