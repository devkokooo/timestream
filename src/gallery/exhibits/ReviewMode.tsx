import { ReviewMode } from "@/worktree/ReviewMode";
import { EMPTY_STATUS, STATUS, SYNC } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import type { Scenario } from "../scenario";

export function ReviewModeExhibit({ scenario }: { scenario: Scenario }) {
  const status = scenario === "loading" ? null : scenario === "empty" ? EMPTY_STATUS : STATUS;
  const transmitting = scenario === "error";
  return (
    <Frame>
      <ReviewMode
        status={status}
        selected={scenario === "success" ? { side: "staged", path: "src/lib/graph.rs" } : null}
        onOpenFile={noop}
        onStage={noopAsync}
        onUnstage={noopAsync}
        onCommit={noopAsync}
        busy={transmitting}
        fetching={transmitting}
        pulling={false}
        pushing={false}
        sync={SYNC}
        onBranch
        hasHead
        headFiling={{ summary: "Keep the sacred river centered.", body: "" }}
        onPush={noop}
        onFetch={noop}
        onPull={noop}
      />
    </Frame>
  );
}
