import { HqMode } from "../../components/HqMode";
import type { RequestDeskTab } from "../../components/PrCompare";
import type { HqTab } from "../../lib/types";
import { MANY_BRANCHES, REPO } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import { useExhibitTab } from "../exhibitUi";

export function HqModeExhibit() {
  const [tab, onTab] = useExhibitTab<HqTab>("hq-mode", "requests");
  const [deskTab, onDeskTab] = useExhibitTab<RequestDeskTab>("hq-mode-desk", "conversation");
  return (
    <Frame>
      <HqMode
        owner="tva"
        repoName="timestream"
        signedIn
        onSignIn={noop}
        onSignOut={noop}
        repoPath={REPO.path}
        currentBranch="feature"
        sacredBranch="main"
        timeline={MANY_BRANCHES}
        onCheckoutPr={noopAsync}
        onSyncAfterMerge={noopAsync}
        onCreateTag={noop}
        onPushTag={noop}
        selectedSha={MANY_BRANCHES.head}
        tab={tab}
        onTab={onTab}
        deskTab={deskTab}
        onDeskTab={onDeskTab}
      />
    </Frame>
  );
}

export function HqClearanceExhibit() {
  return (
    <Frame>
      <HqMode
        owner="tva"
        repoName="timestream"
        signedIn={false}
        onSignIn={noop}
        onSignOut={noop}
        repoPath={REPO.path}
        currentBranch="main"
        sacredBranch="main"
        timeline={MANY_BRANCHES}
        onCheckoutPr={noopAsync}
        onSyncAfterMerge={noopAsync}
        onCreateTag={noop}
        onPushTag={noop}
        selectedSha={MANY_BRANCHES.head}
      />
    </Frame>
  );
}
