import { type ReactNode } from "react";
import { SiGithub } from "react-icons/si";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/ui/cn";
import { btn, btnPrimary, emptyText, eyebrow } from "@/ui/ui";
import { classifyGithubDispatch } from "@/github/dispatch";
import { DispatchNotice } from "@/ui/DispatchNotice";
import { TvaTerm } from "@/ui/TvaTerm";
import { TransmitButton } from "@/ui/TransmitButton";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import type { FeatureDesk } from "@/github/hqTypes";

export function TabBtn({
  active,
  onClick,
  flavor,
  noun,
}: {
  active: boolean;
  onClick: () => void;
  flavor: string;
  noun: string;
}) {
  return (
    <button
      type="button"
      className={`min-w-0 flex-1 border-0 px-1 py-2 ${active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"}`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
    </button>
  );
}

export function HqDesk({
  left,
  middle,
  right,
}: {
  left: ReactNode;
  middle: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      data-workspace
      className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px]"
    >
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
        {left}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e]">
        {middle}
      </div>
      <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#16120e]">
        {right}
      </aside>
    </div>
  );
}

export function HqDispatch({
  error,
  compact,
  onRetry,
  onSignIn,
}: {
  error?: string | null;
  compact?: boolean;
  onRetry?: () => void;
  onSignIn?: () => void;
}) {
  if (!error) return null;
  if (!classifyGithubDispatch(error)) {
    return <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p>;
  }
  return (
    <div className="mt-2">
      <DispatchNotice error={error} compact={compact} onRetry={onRetry} onSignIn={onSignIn} />
    </div>
  );
}

export function HqListPane({
  title,
  count,
  filters,
  extra,
  error,
  empty,
  onRetry,
  onSignIn,
  children,
}: {
  title: string;
  count: number;
  filters?: ReactNode;
  extra?: ReactNode;
  error?: string | null;
  empty: string;
  onRetry?: () => void;
  onSignIn?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col py-3 pr-2.5 pl-3.5">
      <div className="mb-2 shrink-0">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
          {title} <span className="text-tva-muted">{count}</span>
        </h3>
        {filters ? <div className="mt-2 flex flex-wrap gap-1">{filters}</div> : null}
        {extra}
        {error && count > 0 ? (
          <HqDispatch error={error} compact onRetry={onRetry} onSignIn={onSignIn} />
        ) : null}
      </div>
      {error && count === 0 ? (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <HqDispatch error={error} onRetry={onRetry} onSignIn={onSignIn} />
        </div>
      ) : count === 0 || !children ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>{empty}</div>
        </TvaScrollArea>
      ) : (
        children
      )}
    </div>
  );
}

export function FeatureSeal({
  kind,
  features,
  onRecheckFeatures,
  recheckingFeatures,
  recheckError,
}: FeatureDesk & { kind: "requests" | "incidents" }) {
  const settingsUrl = features?.htmlUrl ? `${features.htmlUrl.replace(/\/$/, "")}/settings` : null;
  const noun = kind === "requests" ? "Pull requests" : "Issues";
  const flavor = kind === "requests" ? "Requests sealed" : "Incidents sealed";
  const copy = features?.archived
    ? "This origin archive is frozen. GitHub will not accept new requests or incidents."
    : `${noun} are off on this origin. Enable them in GitHub Settings → General → Features, then recheck.`;

  return (
    <div className="mb-3 border border-tva-stamp/40 bg-[#2a1814] p-3">
      <p className="m-0 text-[10px] uppercase tracking-[0.14em] text-tva-stamp">{flavor}</p>
      <p className={cn(emptyText, "mt-2")}>{copy}</p>
      <HqDispatch error={recheckError} compact />
      <div className="mt-3 flex flex-wrap gap-2">
        {settingsUrl ? (
          <button type="button" className={btn} onClick={() => void openUrl(settingsUrl)}>
            Open GitHub settings
          </button>
        ) : null}
        {features?.archived ? null : (
          <TransmitButton
            active={recheckingFeatures}
            disabled={recheckingFeatures}
            idleClass={btn}
            onClick={onRecheckFeatures}
            title={`Recheck whether ${noun.toLowerCase()} are enabled`}
            label="Rechecking…"
            flavor="Recanvass"
            noun="Recheck features"
            busyNoun="Rechecking…"
          />
        )}
      </div>
    </div>
  );
}

export function NeedClearance() {
  return (
    <p className={`${emptyText} p-4`}>
      Sign in with GitHub to load this desk.
    </p>
  );
}

const TIMESTREAM_GITHUB_APP = "https://github.com/apps/timestream-vcs";

export function HqClearance({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex w-full max-w-[28rem] flex-col items-center text-center">
      <p className={eyebrow}>HQ desk</p>
      <h2 className="mt-2 mb-0 font-display text-[18px] tracking-[0.14em] text-tva-gold">
        Clearance required
      </h2>
      <p className={cn(emptyText, "mt-3 max-w-[24rem]")}>
        Sign in with GitHub to run this desk against the origin archive.
      </p>
      <ul className="mt-4 mb-0 w-full list-none p-0 text-left text-[12px] leading-[1.55] text-tva-paper-dim">
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Requests</span> — list, open, review, and merge pull requests; check out a request locally
        </li>
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Incidents</span> — file and comment on issues
        </li>
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Canon</span> — declare and publish releases
        </li>
        <li className="py-1.5">
          <span className="text-tva-gold">Integrity</span> — read check runs and re-run failed Actions jobs
        </li>
      </ul>
      <button
        type="button"
        className={cn(btn, "mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5")}
        onClick={() => void openUrl(TIMESTREAM_GITHUB_APP)}
      >
        Install the GitHub App
      </button>
      <button
        type="button"
        className={cn(btnPrimary, "mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5")}
        onClick={onSignIn}
      >
        <SiGithub size={14} aria-hidden />
        Sign in with GitHub
      </button>
      <p className={cn(emptyText, "mt-3 max-w-[24rem]")}>
        If the sign-in window does not open, install Timestream on the account or organization first.
      </p>
    </div>
  );
}
