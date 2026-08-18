import { SiGithub } from "react-icons/si";
import { classifyGithubDispatch } from "../lib/githubDispatch";
import { cn } from "../lib/cn";
import { btn, btnPrimary, emptyText, stamp } from "../lib/ui";
import { TransmitButton } from "./TransmitButton";

export function DispatchNotice({
  error,
  compact,
  onRetry,
  onSignIn,
  retrying,
}: {
  error: unknown;
  compact?: boolean;
  onRetry?: () => void;
  onSignIn?: () => void;
  retrying?: boolean;
}) {
  const dispatch = classifyGithubDispatch(error);
  if (!dispatch) return null;

  return (
    <div
      className={cn(
        "border border-tva-stamp/40 bg-[#2a1814]",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 text-[10px] uppercase tracking-[0.14em] text-tva-stamp">{dispatch.title}</p>
        <span className={stamp}>{dispatch.stamp}</span>
      </div>
      <p className={cn(emptyText, compact ? "mt-1.5" : "mt-2")}>{dispatch.body}</p>
      {dispatch.kind === "auth" && onSignIn ? (
        <button
          type="button"
          className={cn(btnPrimary, "mt-3 inline-flex items-center justify-center gap-2")}
          onClick={onSignIn}
        >
          <SiGithub size={14} aria-hidden />
          Sign in with GitHub
        </button>
      ) : onRetry ? (
        <div className="mt-3">
          <TransmitButton
            active={Boolean(retrying)}
            disabled={Boolean(retrying)}
            idleClass={btn}
            onClick={onRetry}
            title="Recanvass origin"
            label="Recanvassing…"
            flavor="Recanvass"
            noun="Retry dispatch"
            busyNoun="Recanvassing…"
          />
        </div>
      ) : null}
    </div>
  );
}
