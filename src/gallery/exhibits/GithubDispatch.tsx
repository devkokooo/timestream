import { DispatchNotice } from "@/ui/DispatchNotice";
import { DISPATCH_SPECIMENS } from "../scenario";
import { Frame, Pad, noop } from "../frame";

export function GithubDispatchExhibit() {
  return (
    <Frame>
      <Pad>
        {DISPATCH_SPECIMENS.map((error) => (
          <DispatchNotice key={error} error={error} onRetry={noop} onSignIn={noop} />
        ))}
      </Pad>
    </Frame>
  );
}
