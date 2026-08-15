import type { RecentRepo } from "../lib/recentRepos";
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  recent: RecentRepo[];
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onBrowse: () => void;
  error: string | null;
}

function parentPath(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  const idx = trimmed.lastIndexOf(sep);
  if (idx <= 0) return "";
  return trimmed.slice(0, idx);
}

export function WelcomeGate({
  recent,
  onOpenRecent,
  onRemoveRecent,
  onBrowse,
  error,
}: Props) {
  return (
    <div className="welcome">
      <div className="welcome-shell">
        <aside className="welcome-actions">
          <div className="welcome-brand">
            <svg className="mark-seal" viewBox="0 0 64 64" aria-hidden>
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="#2b2118"
                stroke="#e85d04"
                strokeWidth="3"
              />
              <path d="M10 32 H54" stroke="#f4c430" strokeWidth="3" />
              <path
                d="M32 32 C 40 18, 50 18, 56 24"
                fill="none"
                stroke="#e85d04"
                strokeWidth="2.4"
              />
              <circle cx="32" cy="32" r="4" fill="#f4c430" />
            </svg>
            <div>
              <p className="eyebrow">Chronomonitoring</p>
              <h1 className="welcome-title">TIMESTREAM</h1>
            </div>
          </div>

          <p className="welcome-lede">
            Open a local working tree to reconstruct the Sacred Timeline.
          </p>

          <button className="btn primary welcome-open" onClick={onBrowse}>
            Open project
          </button>

          {error ? <div className="error">{error}</div> : null}
        </aside>

        <section className="welcome-recents">
          <div className="welcome-recents-head">
            <h2>Recent</h2>
            {recent.length > 0 ? (
              <span className="welcome-count">{recent.length}</span>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <p className="welcome-empty">
              No recent projects yet. Open a repository to begin review.
            </p>
          ) : (
            <TvaScrollArea className="recent-scroll" axis="y" fill>
              <ul className="recent-list">
                {recent.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      className="recent-item"
                      onClick={() => onOpenRecent(item.path)}
                    >
                      <span className="recent-name">{item.name}</span>
                      <span className="recent-path">
                        {parentPath(item.path) || item.path}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="recent-remove"
                      aria-label={`Remove ${item.name} from recent`}
                      onClick={() => onRemoveRecent(item.path)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </TvaScrollArea>
          )}
        </section>
      </div>
    </div>
  );
}
