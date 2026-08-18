import { HqMode } from "../../components/HqMode";
import { MANY_BRANCHES, REPO } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";

export function HqModeExhibit() {
  return (
    <Frame>
      <HqMode
        owner="tva"
        repoName="timestream"
        signedIn
        onSignIn={noop}
        repoPath={REPO.path}
        currentBranch="feature"
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

export function HqClearanceExhibit() {
  return (
    <Frame>
      <HqMode
        owner="tva"
        repoName="timestream"
        signedIn={false}
        onSignIn={noop}
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
