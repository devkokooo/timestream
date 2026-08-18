import { useState, type ReactNode } from "react";
import { IdentityPicker, type IdentityChoice } from "../../../../src/components/IdentityPicker";
import { TvaJumble } from "../../../../src/components/TvaJumble";
import { TvaTerm } from "../../../../src/components/TvaTerm";
import { btn, eyebrow, panelTitle, stamp, stampGold } from "../../../../src/lib/ui";
import { cn } from "../../../../src/lib/cn";
import { REMOTE, SSH_KEYS } from "../../lib/tourData";

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[min(560px,100%)] flex-col gap-4 border border-tva-gold/28 bg-[#1b1713] p-5">
      {children}
    </div>
  );
}

export function PushDesk() {
  const [choice, setChoice] = useState<IdentityChoice | null>(null);
  const [binding, setBinding] = useState(false);

  function bind(next: IdentityChoice) {
    if (binding) return;
    setBinding(true);
    window.setTimeout(() => {
      setBinding(false);
      setChoice(next);
    }, 800);
  }

  if (binding) {
    return (
      <Panel>
        <header className="flex flex-col gap-2">
          <h2 className={panelTitle}>
            <TvaJumble label="Filing identity" noun="Adding key to ssh-agent" />
          </h2>
          <p className="m-0 text-xs text-tva-paper-dim">Fast-forward only. No force-push.</p>
        </header>
      </Panel>
    );
  }

  if (!choice) {
    return <IdentityPicker open inline onClose={() => {}} onChoose={bind} />;
  }

  const key = SSH_KEYS.find((item) => item.path === choice.keyPath);
  const name = choice.keyPath.split("/").pop() ?? choice.keyPath;

  return (
    <Panel>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className={panelTitle}>
            <TvaTerm flavor="Identity bound" noun="SSH key selected for GitHub" />
          </h2>
          <p className="m-0 text-xs text-tva-paper-dim">
            Agent has the key. Tokens never land in settings.toml.
          </p>
        </div>
        <span className={cn(stamp, stampGold, "rotate-0")}>BOUND</span>
      </header>
      <div className="flex flex-col gap-1 border border-tva-gold/12 px-2.5 py-2 text-xs">
        <p className={eyebrow}>Selected</p>
        <p className="m-0 text-tva-paper">{name}</p>
        <p className="m-0 text-tva-muted">{key?.comment || "no comment"}</p>
        <p className="m-0 font-mono text-[10px] text-tva-muted">{key?.fingerprint ?? choice.keyPath}</p>
      </div>
      <p className="m-0 font-mono text-[0.6875rem] text-tva-muted">{REMOTE}</p>
      <button type="button" className={`${btn} self-start`} onClick={() => setChoice(null)}>
        <TvaTerm flavor="Choose another" noun="Pick a different SSH key" />
      </button>
    </Panel>
  );
}
