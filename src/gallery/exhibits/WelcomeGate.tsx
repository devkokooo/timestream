import { WelcomeGate } from "../../components/WelcomeGate";
import { ANALYST, CLONE_LOG, RECENT, SEARCH_HITS } from "../fixtures";
import { Frame, noop } from "../frame";
import { SPECIMEN_ERROR, type Scenario } from "../scenario";

export function WelcomeGateExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame>
      <WelcomeGate
        recent={scenario === "empty" ? [] : RECENT}
        onOpenRecent={noop}
        onRemoveRecent={noop}
        onBrowse={noop}
        onClone={noop}
        onSearchRepos={async () => (scenario === "empty" ? [] : SEARCH_HITS)}
        onSignIn={noop}
        onSettings={noop}
        user={scenario === "empty" ? null : ANALYST}
        error={scenario === "error" ? SPECIMEN_ERROR : null}
        cloneLog={scenario === "loading" ? CLONE_LOG : []}
        cloning={scenario === "loading"}
      />
    </Frame>
  );
}
