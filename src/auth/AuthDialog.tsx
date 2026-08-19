import { GithubSignIn } from "@/github/auth/GithubSignIn";
import { panelTitle } from "@/ui/ui";
import { TvaTerm } from "@/ui/TvaTerm";
import type { ForgeUser } from "@/auth/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: ForgeUser) => void;
}

export function AuthDialog({ open, onClose, onSignedIn }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      <div className="w-[min(480px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5">
        <h2 className={panelTitle}>
          <TvaTerm flavor="Clearance" noun="Sign in with GitHub" />
        </h2>
        <GithubSignIn onSignedIn={onSignedIn} onCancel={onClose} />
      </div>
    </div>
  );
}
