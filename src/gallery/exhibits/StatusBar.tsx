import { StatusBar } from "@/shell/StatusBar";
import { ORIGIN, REPO, SYNC } from "../fixtures";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function StatusBarExhibit({ scenario }: { scenario: Scenario }) {
  if (scenario === "empty") {
    return (
      <Frame className="justify-end">
        <StatusBar repo={null} origin={null} sync={null} />
      </Frame>
    );
  }
  return (
    <Frame className="justify-end">
      <StatusBar
        repo={scenario === "error" ? { ...REPO, branch: null } : REPO}
        origin={ORIGIN}
        sync={scenario === "loading" ? null : SYNC}
        onBranchClick={noop}
      />
    </Frame>
  );
}
