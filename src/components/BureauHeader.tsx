import type { RepoSummary } from "../lib/types";

interface Props {
  repo: RepoSummary;
  onOpen: () => void;
  onReload: () => void;
}

export function BureauHeader({ repo, onOpen, onReload }: Props) {
  return (
    <header className="bureau-header">
      <div className="mark">
        <svg className="mark-seal" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="28" fill="#2b2118" stroke="#e85d04" strokeWidth="3" />
          <path d="M10 32 H54" stroke="#f4c430" strokeWidth="3" />
          <path d="M32 32 C 40 18, 50 18, 56 24" fill="none" stroke="#e85d04" strokeWidth="2.4" />
          <circle cx="32" cy="32" r="4" fill="#f4c430" />
        </svg>
        <div>
          <p className="eyebrow">Time Variance Authority</p>
          <h1 className="wordmark">TIMESTREAM</h1>
        </div>
      </div>
      <div className="file-meta">
        <span>CHRONOMONITORING DIVISION</span>
        <span>
          FILE {repo.name.toUpperCase()} · {repo.branch ?? "DETACHED"} ·{" "}
          {repo.head?.slice(0, 7) ?? "—"}
        </span>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={onReload}>
          Rescan
        </button>
        <button className="btn primary" onClick={onOpen}>
          Open archive
        </button>
      </div>
    </header>
  );
}
