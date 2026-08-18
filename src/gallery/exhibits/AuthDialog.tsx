import { AuthDialog } from "../../components/AuthDialog";
import { Frame, noop } from "../frame";

export function AuthDialogExhibit() {
  return (
    <Frame>
      <AuthDialog open onClose={noop} onSignedIn={noop} />
    </Frame>
  );
}
