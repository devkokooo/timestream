import { AboutDialog } from "@/shell/AboutDialog";
import { Frame, noop } from "../frame";

export function AboutDialogExhibit() {
  return (
    <Frame>
      <AboutDialog open onClose={noop} />
    </Frame>
  );
}
