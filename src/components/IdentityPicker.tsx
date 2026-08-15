import { useEffect, useState } from "react";
import { listSshKeys, pickSshKey, sshAgentEnsure, sshAgentStatus } from "../lib/api";
import { btn, btnPrimary, emptyText, fieldInput, fieldLabel, panelTitle } from "../lib/ui";
import type { SshAgentStatus, SshKeyInfo } from "../lib/types";
import { TvaTerm } from "./TvaTerm";
import { TvaScrollArea } from "./TvaScrollArea";

export interface IdentityChoice {
  keyPath: string;
  passphrase?: string;
  rememberKey: boolean;
  rememberDefault: boolean;
  rememberPassphrase: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: IdentityChoice) => void;
}

export function IdentityPicker({ open, onClose, onChoose }: Props) {
  const [keys, setKeys] = useState<SshKeyInfo[]>([]);
  const [agent, setAgent] = useState<SshAgentStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [rememberKey, setRememberKey] = useState(true);
  const [rememberDefault, setRememberDefault] = useState(false);
  const [rememberPassphrase, setRememberPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([listSshKeys(), sshAgentStatus()])
      .then(([nextKeys, nextAgent]) => {
        setKeys(nextKeys);
        setAgent(nextAgent);
        setSelected(nextKeys[0]?.path ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      <div className="w-[min(560px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <h2 className={panelTitle}>
          <TvaTerm flavor="Choose identity" noun="Select an SSH key for GitHub" />
        </h2>
        <p className="mt-2 mb-3 text-xs text-tva-paper-dim">
          Different GitHub accounts often need different keys. Timestream can start ssh-agent and remember this choice.
        </p>
        {agent && !agent.running ? (
          <div className="mb-3 border border-tva-stamp/40 bg-[#2a1814] px-3 py-2 text-xs text-[#f3c2b8]">
            {agent.hint ?? "Windows OpenSSH agent is not running."}
            <button
              type="button"
              className={`${btn} ml-2`}
              onClick={() => {
                void sshAgentEnsure()
                  .then(setAgent)
                  .catch((err) => setError(String(err)));
              }}
            >
              <TvaTerm flavor="Start agent" noun="Start ssh-agent" />
            </button>
          </div>
        ) : null}
        <TvaScrollArea className="max-h-56" axis="y">
          {keys.length === 0 ? (
            <p className={emptyText}>No keys found in ~/.ssh. Browse for a private key.</p>
          ) : (
            keys.map((key) => (
              <label
                key={key.path}
                className="mb-1 flex cursor-pointer items-start gap-2 border border-tva-gold/12 px-2 py-2 text-xs hover:bg-tva-orange/8"
              >
                <input
                  type="radio"
                  name="ssh-key"
                  checked={selected === key.path}
                  onChange={() => setSelected(key.path)}
                />
                <span>
                  <span className="block text-tva-paper">{key.path.split("/").pop()}</span>
                  <span className="block text-tva-muted">{key.comment || "no comment"}</span>
                  <span className="block font-mono text-[10px] text-tva-muted" title="SSH fingerprint">
                    {key.fingerprint}
                  </span>
                </span>
              </label>
            ))
          )}
        </TvaScrollArea>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              const picked = await pickSshKey();
              if (picked) setSelected(picked.replaceAll("\\", "/"));
            }}
          >
            Browse…
          </button>
        </div>
        <label className="mt-3 flex flex-col gap-1">
          <span className={fieldLabel}>Passphrase (optional)</span>
          <input
            type="password"
            className={fieldInput}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-tva-paper-dim">
          <input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} />
          Remember for this remote · Save this key for origin on this repo
        </label>
        <label className="mt-1 flex items-center gap-2 text-xs text-tva-paper-dim">
          <input
            type="checkbox"
            checked={rememberDefault}
            onChange={(e) => setRememberDefault(e.target.checked)}
          />
          Remember as default for github.com
        </label>
        <label className="mt-1 flex items-center gap-2 text-xs text-tva-paper-dim">
          <input
            type="checkbox"
            checked={rememberPassphrase}
            onChange={(e) => setRememberPassphrase(e.target.checked)}
          />
          Store passphrase in OS keychain
        </label>
        {error ? <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onChoose({
                keyPath: selected,
                passphrase: passphrase || undefined,
                rememberKey,
                rememberDefault,
                rememberPassphrase,
              });
            }}
          >
            Use key
          </button>
        </div>
      </div>
    </div>
  );
}
