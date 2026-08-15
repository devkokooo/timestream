import { cn } from "../lib/cn";
import { btn, btnPrimary, errorText, eyebrow } from "../lib/ui";
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
    <div className="grid flex-1 place-items-center px-6 py-10">
      <div className="grid min-h-[420px] w-[min(860px,100%)] overflow-hidden border border-tva-gold/24 bg-[linear-gradient(180deg,rgba(243,226,194,0.06),transparent_35%),#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.5)] max-[720px]:min-h-0 max-[720px]:grid-cols-1 grid-cols-[minmax(240px,300px)_1fr]">
        <aside className="flex flex-col gap-[18px] border-r border-tva-gold/16 bg-linear-to-b from-[#241e18] to-[#171310] px-6 py-7 max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-tva-gold/16">
          <div className="flex items-center gap-3">
            <svg className="size-[42px]" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="28" fill="#2b2118" stroke="#e85d04" strokeWidth="3" />
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
              <p className={eyebrow}>Chronomonitoring</p>
              <h1 className="mt-1 mb-0 font-display text-[22px] font-semibold tracking-[0.16em]">
                TIMESTREAM
              </h1>
            </div>
          </div>

          <p className="m-0 text-xs leading-[1.55] text-tva-paper-dim">
            Open a local working tree to reconstruct the Sacred Timeline.
          </p>

          <button type="button" className={cn(btn, btnPrimary, "w-full px-3.5 py-2.5")} onClick={onBrowse}>
            Open project
          </button>

          {error ? <div className={errorText}>{error}</div> : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col px-2 pt-[22px] pb-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-tva-gold/12 px-4 pb-3">
            <h2 className="m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-tva-gold">
              Recent
            </h2>
            {recent.length > 0 ? (
              <span className="text-[11px] text-tva-muted">{recent.length}</span>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <p className="m-0 px-4 py-7 text-xs leading-normal text-tva-muted">
              No recent projects yet. Open a repository to begin review.
            </p>
          ) : (
            <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
              <ul className="m-0 list-none px-0 py-1.5">
                {recent.map((item) => (
                  <li key={item.path} className="group grid grid-cols-[1fr_auto] items-stretch">
                    <button
                      type="button"
                      className="flex w-full min-w-0 flex-col items-start gap-[3px] border-0 bg-transparent px-4 py-2.5 text-left text-inherit hover:bg-tva-orange/10"
                      onClick={() => onOpenRecent(item.path)}
                    >
                      <span className="text-[13px] font-medium text-tva-paper">{item.name}</span>
                      <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-tva-muted">
                        {parentPath(item.path) || item.path}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="border-0 bg-transparent px-3.5 text-[18px] leading-none text-tva-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-tva-stamp"
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
