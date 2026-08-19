import { useEffect, useState } from "react";
import { listSshKeys, pickSshKey, sshAgentEnsure, sshAgentStatus } from "@/ssh/api";
import { btn, btnPrimary, emptyText, fieldInput, fieldLabel, panelTitle } from "@/ui/ui";
import type { SshAgentStatus, SshKeyInfo } from "@/ssh/types";
import { TvaTerm } from "@/ui/TvaTerm";
import { TvaScrollArea } from "@/ui/TvaScrollArea";

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
  /** Render the panel in place, without a modal overlay. */
  inline?: boolean;
}

export function IdentityPicker({ open, onClose, onChoose, inline = false }: Props) {
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

  const panel = (
    <div
      className={`flex w-[min(560px,100%)] flex-col gap-4 border border-tva-gold/28 bg-[#1b1713] p-5 ${
        inline ? "" : "shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      }`}
    >
      <header className="flex flex-col gap-2">
          <h2 className={panelTitle}>
            <TvaTerm flavor="Choose identity" noun="Select an SSH key for GitHub" />
          </h2>
          <p className="m-0 text-xs text-tva-paper-dim">
            Different GitHub accounts often need different keys. Timestream can start ssh-agent and remember this choice.
          </p>
        </header>
        {agent && !agent.running ? (
          <div className="flex flex-col gap-2 border border-tva-stamp/40 bg-[#2a1814] px-3 py-2.5">
            <p className="m-0 text-xs leading-5 text-[#f3c2b8]">
              {agent.hint ?? "Windows OpenSSH agent is not running."}
            </p>
            <button
              type="button"
              className={`${btn} self-start`}
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
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>SSH keys</span>
          <TvaScrollArea className="max-h-56" axis="y">
            {keys.length === 0 ? (
              <p className={emptyText}>No keys found in ~/.ssh. Browse for a private key.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {keys.map((key) => (
                  <label
                    key={key.path}
                    className="flex cursor-pointer items-start gap-2.5 border border-tva-gold/12 px-2.5 py-2 text-xs hover:bg-tva-orange/8"
                  >
                    <input
                      type="radio"
                      name="ssh-key"
                      className="mt-0.5"
                      checked={selected === key.path}
                      onChange={() => setSelected(key.path)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-tva-paper">{key.path.split("/").pop()}</span>
                      <span className="block text-tva-muted">{key.comment || "no comment"}</span>
                      <span className="block font-mono text-[10px] text-tva-muted" title="SSH fingerprint">
                        {key.fingerprint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </TvaScrollArea>
          <button
            type="button"
            className={`${btn} self-start`}
            onClick={async () => {
              const picked = await pickSshKey();
              if (picked) setSelected(picked.replaceAll("\\", "/"));
            }}
          >
            Browse…
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Passphrase (optional)</span>
          <input
            type="password"
            className={fieldInput}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={rememberKey}
              onChange={(e) => setRememberKey(e.target.checked)}
            />
            <TvaTerm flavor="Remember for this remote" noun="Save this key for origin on this repo" />
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={rememberDefault}
              onChange={(e) => setRememberDefault(e.target.checked)}
            />
            <TvaTerm flavor="Remember as default" noun="Use this key for github.com" />
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={rememberPassphrase}
              onChange={(e) => setRememberPassphrase(e.target.checked)}
            />
            <TvaTerm flavor="Store passphrase" noun="Keep it in the OS keychain" />
          </label>
        </div>
        {error ? <p className="m-0 text-xs text-[#ff8a6a]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          {inline ? null : (
            <button type="button" className={btn} onClick={onClose}>
              Cancel
            </button>
          )}
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
  );

  if (inline) return panel;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      {panel}
    </div>
  );
}
