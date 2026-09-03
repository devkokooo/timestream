import { ReviewMode } from "@/worktree/ReviewMode";
import { EMPTY_STATUS, ORIGIN, STATUS, SYNC, UPSTREAM } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import type { Scenario } from "../scenario";

export function ReviewModeExhibit({ scenario }: { scenario: Scenario }) {
  const status = scenario === "loading" ? null : scenario === "empty" ? EMPTY_STATUS : STATUS;
  const transmitting = scenario === "error";
  const remotes = scenario === "empty" ? [] : [ORIGIN, UPSTREAM];
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
        includeTagsOnPush={scenario === "success"}
        onIncludeTagsOnPush={noop}
        remotes={remotes}
        selectedRemote={scenario === "empty" ? null : "origin"}
        onSelectRemote={noop}
        onManageRemotes={noop}
        onPush={noop}
        onFetch={noop}
        onPull={noop}
      />
    </Frame>
  );
}
