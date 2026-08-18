import { BranchPicker } from "../../components/BranchPicker";
import { StatusBar } from "../../components/StatusBar";
import { ORIGIN, REPO, SYNC } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import type { Scenario } from "../scenario";

export function BranchPickerExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame className="justify-end">
      <BranchPicker
        open
        path="/archives/timestream"
        onClose={noop}
        onSwitch={noopAsync}
        onCreate={noopAsync}
        onRename={noopAsync}
        onDelete={noopAsync}
      />
      <StatusBar
        repo={scenario === "empty" ? null : REPO}
        origin={ORIGIN}
        sync={scenario === "loading" ? null : SYNC}
        onBranchClick={noop}
        branchOpen
      />
    </Frame>
  );
}
