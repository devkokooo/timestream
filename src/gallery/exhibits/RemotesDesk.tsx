import { RemotesDesk } from "@/remotes/RemotesDesk";
import { StatusBar } from "@/shell/StatusBar";
import { ORIGIN, REPO, SYNC } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import type { Scenario } from "../scenario";

export function RemotesDeskExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame className="justify-end">
      <RemotesDesk
        open
        path="/archives/timestream"
        selectedRemote={scenario === "empty" ? null : "origin"}
        onClose={noop}
        onSelect={noop}
        onAdd={noopAsync}
        onSetUrl={noopAsync}
        onRename={noopAsync}
        onRemove={noopAsync}
      />
      <StatusBar
        repo={scenario === "empty" ? null : REPO}
        origin={ORIGIN}
        sync={scenario === "loading" ? null : SYNC}
        onBranchClick={noop}
        branchOpen={false}
      />
    </Frame>
  );
}
