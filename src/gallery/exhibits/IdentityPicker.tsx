import { IdentityPicker } from "../../components/IdentityPicker";
import { Frame, noop } from "../frame";

export function IdentityPickerExhibit() {
  return (
    <Frame>
      <IdentityPicker open onClose={noop} onChoose={noop} />
    </Frame>
  );
}
