import { useEffect, useRef, useState } from "react";
import { cn } from "@/ui/cn";
import { btn, btnPrimary, eyebrow, fieldInput } from "@/ui/ui";
import { classifyGithubDispatch, dispatchMessage } from "@/github/dispatch";
import type { ForgeUser } from "@/auth/types";
import type { RepoSearchHit } from "@/github/types";
import type { RecentRepo } from "@/remotes/recentRepos";
import { DispatchNotice } from "@/ui/DispatchNotice";
import { TvaTerm } from "@/ui/TvaTerm";
import { TvaScrollArea } from "@/ui/TvaScrollArea";

type GateTab = "recent" | "logs";

interface Props {
  recent: RecentRepo[];
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onBrowse: () => void;
  onClone: (url: string) => void;
  onSearchRepos: (query: string) => Promise<RepoSearchHit[]>;
  onSignIn: () => void;
  onSettings: () => void;
  user: ForgeUser | null;
  error: string | null;
  cloneLog: string[];
  cloning: boolean;
  tab?: GateTab;
  onTab?: (tab: GateTab) => void;
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
  onClone,
  onSearchRepos,
  onSignIn,
  onSettings,
  user,
  error,
  cloneLog,
  cloning,
  tab: tabProp,
  onTab,
}: Props) {
  const [tabState, setTabState] = useState<GateTab>("recent");
  const tab = tabProp ?? tabState;
  const setTab = (next: GateTab) => {
    onTab?.(next);
    if (tabProp === undefined) setTabState(next);
  };

  useEffect(() => {
    if (cloning) setTab("logs");
  }, [cloning]);

  return (
    <div className="flex min-h-0 flex-1 justify-center px-6 py-10">
      <div className="grid h-full min-h-0 w-[min(860px,100%)] overflow-hidden border border-tva-gold/24 bg-[linear-gradient(180deg,rgba(243,226,194,0.06),transparent_35%),#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.5)] max-[720px]:grid-cols-1 grid-cols-[minmax(240px,300px)_1fr]">
        <aside className="flex min-h-0 flex-col gap-4.5 overflow-auto border-r border-tva-gold/16 bg-linear-to-b from-[#241e18] to-[#171310] px-6 py-7 max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-tva-gold/16">
          <div className="flex items-center gap-3">
            <img
              className="size-10.5"
              src="/timestream-logo.svg"
              alt=""
              aria-hidden
              draggable={false}
            />
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

          <button type="button" className={cn(btnPrimary, "w-full px-3.5 py-2.5")} onClick={onBrowse}>
            Open project
          </button>
          <CloneBox
            onClone={onClone}
            onSearchRepos={onSearchRepos}
            signedIn={Boolean(user)}
            cloning={cloning}
          />
          <button type="button" className={cn(btn, "w-full")} onClick={onSignIn}>
            <TvaTerm flavor="Clearance" noun={user ? `@${user.login}` : "Sign in with GitHub"} />
          </button>
          <button type="button" className={cn(btn, "w-full")} onClick={onSettings}>
            <TvaTerm flavor="Bureau settings" noun="Settings" />
          </button>

          {error ? (
            classifyGithubDispatch(error) ? (
              <DispatchNotice error={error} compact />
            ) : (
              <div className="mt-2.5 text-xs text-[#ff8a6a]">{error}</div>
            )
          ) : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col px-2 pt-3 pb-4">
          <div className="flex shrink-0 border-b border-tva-gold/12">
            <GateTabBtn
              active={tab === "recent"}
              onClick={() => setTab("recent")}
              flavor="Recent"
              noun="Recent projects"
              count={recent.length || undefined}
            />
            <GateTabBtn
              active={tab === "logs"}
              onClick={() => setTab("logs")}
              flavor="Logs"
              noun="Dispatch transcript"
              live={cloning}
            />
          </div>
          {tab === "recent" ? (
            <RecentList recent={recent} onOpenRecent={onOpenRecent} onRemoveRecent={onRemoveRecent} />
          ) : (
            <CloneTranscript lines={cloneLog} cloning={cloning} />
          )}
        </section>
      </div>
    </div>
  );
}

function GateTabBtn({
  active,
  onClick,
  flavor,
  noun,
  count,
  live,
}: {
  active: boolean;
  onClick: () => void;
  flavor: string;
  noun: string;
  count?: number;
  live?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 border-0 px-1 py-2 ${
        active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"
      }`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
      {live ? (
        <span className="text-[9px] uppercase tracking-[0.14em] text-tva-orange">Live</span>
      ) : count != null ? (
        <span className="text-[10px] text-tva-muted">{count}</span>
      ) : null}
    </button>
  );
}

function RecentList({
  recent,
  onOpenRecent,
  onRemoveRecent,
}: {
  recent: RecentRepo[];
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}) {
  if (recent.length === 0) {
    return (
      <p className="m-0 px-4 py-7 text-xs leading-normal text-tva-muted">
        No recent projects yet. Open a repository to begin review.
      </p>
    );
  }
  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
      <ul className="m-0 list-none px-0 py-1.5">
        {recent.map((item) => (
          <li key={item.path} className="group grid grid-cols-[1fr_auto] items-stretch">
            <button
              type="button"
              className="flex w-full min-w-0 flex-col items-start gap-0.75 border-0 bg-transparent px-4 py-2.5 text-left text-inherit hover:bg-tva-orange/10"
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
  );
}

function CloneBox({
  onClone,
  onSearchRepos,
  signedIn,
  cloning,
}: {
  onClone: (url: string) => void;
  onSearchRepos: (query: string) => Promise<RepoSearchHit[]>;
  signedIn: boolean;
  cloning: boolean;
}) {
  const [url, setUrl] = useState("");
  const [hits, setHits] = useState<RepoSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" className={cn(btn, "w-full")} disabled>
        <TvaTerm flavor="Clone from HQ" noun="Clone a GitHub repository" />
      </button>
      <input
        className={fieldInput}
        placeholder="owner/name or git URL"
        value={url}
        disabled={cloning}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => {
          if (signedIn && url && !url.includes("://") && !url.includes("@")) {
            setSearchError(null);
            void onSearchRepos(url)
              .then((next) => {
                setHits(next);
                setSearchError(null);
              })
              .catch((err) => {
                setHits([]);
                setSearchError(dispatchMessage(err));
              });
          }
        }}
      />
      <button
        type="button"
        className={btn}
        disabled={cloning || !url.trim()}
        onClick={() => onClone(url.trim())}
      >
        {cloning ? "Cloning…" : "Clone"}
      </button>
      {searchError ? <DispatchNotice error={searchError} compact /> : null}
      {hits.map((hit) => (
        <button
          key={hit.fullName}
          type="button"
          className="border-0 bg-transparent px-1 py-1 text-left text-[11px] text-tva-gold"
          disabled={cloning}
          onClick={() => onClone(hit.cloneUrl)}
        >
          {hit.fullName}
        </button>
      ))}
    </div>
  );
}

function CloneTranscript({ lines, cloning }: { lines: string[]; cloning: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, cloning]);
  if (lines.length === 0 && !cloning) {
    return (
      <p className="m-0 px-4 py-7 text-xs leading-normal text-tva-muted">
        No dispatch transcript yet. Clone a repository to record the transfer log.
      </p>
    );
  }
  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
      <pre className="relative m-0 select-text px-4 py-3 font-mono text-[11px] leading-[1.55] text-tva-gold [text-shadow:0_0_12px_rgba(232,184,109,0.18)]">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.slice(0, 24)}`}
            className={line.startsWith("error:") ? "text-[#ff8a6a]" : undefined}
          >
            {line}
          </div>
        ))}
        {cloning ? <div className="animate-pulse text-tva-orange">▍</div> : null}
        <div ref={endRef} />
      </pre>
    </TvaScrollArea>
  );
}
