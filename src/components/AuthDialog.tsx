import { useState } from "react";
import { githubLoginBegin, githubLoginPat, githubLoginPoll } from "../lib/api";
import { openUrl } from "@tauri-apps/plugin-opener";
import { btn, btnPrimary, fieldInput, fieldLabel, panelTitle } from "../lib/ui";
import { TvaTerm } from "./TvaTerm";
import type { GithubUser } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: GithubUser) => void;
}

export function AuthDialog({ open, onClose, onSignedIn }: Props) {
  const [pat, setPat] = useState("");
  const [userCode, setUserCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      <div className="w-[min(480px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5">
        <h2 className={panelTitle}>
          <TvaTerm flavor="Clearance" noun="Sign in with GitHub" />
        </h2>
        <p className="mt-2 text-xs text-tva-paper-dim">
          Device login needs a GitHub OAuth app client id. A personal access token always works.
          Classic token scopes: <span className="text-tva-gold">repo</span>,{" "}
          <span className="text-tva-gold">workflow</span>,{" "}
          <span className="text-tva-gold">read:org</span> (read and write where offered).
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
        <button
          type="button"
          className={`${btnPrimary} mt-3 w-full`}
          onClick={async () => {
            setError(null);
            try {
              const begin = await githubLoginBegin();
              if (!begin.clientIdConfigured) {
                setHint("OAuth client id is not configured. Paste a personal access token below.");
                return;
              }
              setUserCode(begin.userCode);
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
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Device login
        </button>
        {userCode ? (
          <p className="mt-2 font-mono text-sm text-tva-gold">
            Enter code {userCode} at GitHub
          </p>
        ) : null}
        <label className="mt-4 flex flex-col gap-1">
          <span className={fieldLabel}>Personal access token</span>
          <input
            type="password"
            className={fieldInput}
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            autoComplete="off"
          />
        </label>
        {hint ? <p className="mt-2 text-xs text-tva-gold">{hint}</p> : null}
        {error ? <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!pat.trim()}
            onClick={async () => {
              try {
                const user = await githubLoginPat(pat.trim());
                onSignedIn(user);
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Store token
          </button>
        </div>
      </div>
    </div>
  );
}
