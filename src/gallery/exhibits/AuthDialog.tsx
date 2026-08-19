import { AuthDialog } from "@/auth/AuthDialog";
import { GithubSignIn } from "@/github/auth/GithubSignIn";
import { Frame, noop } from "../frame";

export function AuthDialogExhibit() {
  return (
    <Frame>
      <AuthDialog open onClose={noop} onSignedIn={noop} />
    </Frame>
  );
}

export function GithubSignInExhibit() {
  return (
    <Frame>
      <div className="grid h-full place-items-center p-6">
        <div className="w-[min(480px,100%)] border border-tva-gold/28 bg-[#1b1713] p-5">
          <GithubSignIn onSignedIn={noop} onCancel={noop} />
        </div>
      </div>
    </Frame>
  );
}

