import { useState } from "react";
import { VscCopy } from "react-icons/vsc";
import { SiGithub } from "react-icons/si";
import { githubLoginBegin, githubLoginPat, githubLoginPoll } from "../lib/api";
import { classifyGithubDispatch, dispatchMessage } from "../lib/githubDispatch";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "../lib/cn";
import { btn, btnPrimary, fieldInput, fieldLabel, panelTitle } from "../lib/ui";
import { DispatchNotice } from "./DispatchNotice";
import { TvaTerm } from "./TvaTerm";
import type { GithubUser } from "../lib/types";

const TIMESTREAM_GITHUB_APP = "https://github.com/apps/timestream-vcs";

interface Props {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: GithubUser) => void;
}

export function AuthDialog({ open, onClose, onSignedIn }: Props) {
  const [pat, setPat] = useState("");
  const [userCode, setUserCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      <div className="w-[min(480px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5">
        <h2 className={panelTitle}>
          <TvaTerm flavor="Clearance" noun="Sign in with GitHub" />
        </h2>
        <p className="mt-2 text-xs text-tva-paper-dim">
          Device login uses the Timestream GitHub App. Install the app on the account or
          organization whose archives you need, then enter the code GitHub shows. If the
          browser window does not open, use the install link below.
        </p>
        <button
          type="button"
          className={`${btn} mt-5 inline-flex w-full items-center justify-center gap-2`}
          onClick={() => void openUrl(TIMESTREAM_GITHUB_APP)}
        >
          Install the GitHub App
        </button>
        <button
          type="button"
          className={`${btnPrimary} mt-2 inline-flex w-full items-center justify-center gap-2`}
          disabled={busy}
          onClick={async () => {
            setError(null);
            setHint(null);
            setBusy(true);
            try {
              const begin = await githubLoginBegin();
              if (!begin.clientIdConfigured) {
                setHint(
                  "GitHub App client id is not configured. Paste a personal access token below.",
                );
                return;
              }
              setUserCode(begin.userCode);
              setCopied(false);
              await openUrl(begin.verificationUri);
              const deadline = Date.now() + begin.expiresIn * 1000;
              while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, begin.interval * 1000));
                const user = await githubLoginPoll(begin.deviceCode);
                if (user) {
                  onSignedIn(user);
                  onClose();
                  return;
                }
              }
              setError("Device login expired.");
            } catch (err) {
              setError(dispatchMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <SiGithub size={14} aria-hidden />
          Sign in with GitHub
        </button>
        {userCode ? (
          <p className="mt-3 text-xs text-tva-paper-dim">
            Enter{" "}
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 border border-tva-gold/28 bg-[#120e0b] px-1.5 py-0.5 align-middle",
                "font-mono text-sm text-tva-gold hover:border-tva-orange hover:text-tva-gold-bright",
              )}
              title={copied ? "Copied" : "Copy device code"}
              onClick={() => {
                void navigator.clipboard.writeText(userCode).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              <code className="font-mono tracking-[0.12em]">{userCode}</code>
              <VscCopy size={12} aria-hidden />
              <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
            </button>{" "}
            at GitHub
            {copied ? <span className="ml-2 text-tva-gold">Copied</span> : null}
          </p>
        ) : null}
        <details className="mt-4">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.08em] text-tva-gold">
            Or paste a personal access token
          </summary>
          <p className="mt-2 text-xs text-tva-paper-dim">
            Fallback when the GitHub App is not configured. Classic scopes:{" "}
            <span className="text-tva-gold">repo</span>,{" "}
            <span className="text-tva-gold">workflow</span>,{" "}
            <span className="text-tva-gold">read:org</span>.
          </p>
          <button
            type="button"
            className={`${btn} mt-2 w-full`}
            onClick={() =>
              void openUrl(
                "https://github.com/settings/tokens/new?description=Timestream&scopes=repo,workflow,read:org",
              )
            }
          >
            Create a classic token
          </button>
          <label className="mt-3 flex flex-col gap-1">
            <span className={fieldLabel}>Personal access token</span>
            <input
              type="password"
              className={fieldInput}
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className={`${btnPrimary} mt-3 w-full`}
            disabled={!pat.trim() || busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const user = await githubLoginPat(pat.trim());
                onSignedIn(user);
                onClose();
              } catch (err) {
                setError(dispatchMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Store token
          </button>
        </details>
        {hint ? <p className="mt-2 text-xs text-tva-gold">{hint}</p> : null}
        {error ? (
          classifyGithubDispatch(error) ? (
            <div className="mt-2">
              <DispatchNotice error={error} compact />
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p>
          )
        ) : null}
        <div className="mt-4 flex justify-end">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
