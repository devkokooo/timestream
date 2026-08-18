import { WelcomeGate } from "../../components/WelcomeGate";
import { ANALYST, CLONE_LOG, RECENT, SEARCH_HITS } from "../fixtures";
import { Frame, noop } from "../frame";
import { useExhibitTab } from "../exhibitUi";
import { SPECIMEN_ERROR, SPECIMEN_OUTAGE, type Scenario } from "../scenario";

export function WelcomeGateExhibit({ scenario }: { scenario: Scenario }) {
  const [tab, onTab] = useExhibitTab<"recent" | "logs">("welcome-gate", "recent");
  return (
    <Frame>
      <WelcomeGate
        recent={scenario === "empty" ? [] : RECENT}
        onOpenRecent={noop}
        onRemoveRecent={noop}
        onBrowse={noop}
        onClone={noop}
        onSearchRepos={async () => {
          if (scenario === "outage") throw new Error(SPECIMEN_OUTAGE);
          return scenario === "empty" ? [] : SEARCH_HITS;
        }}
        onSignIn={noop}
        onSettings={noop}
        user={scenario === "empty" ? null : ANALYST}
        error={scenario === "error" ? SPECIMEN_ERROR : scenario === "outage" ? SPECIMEN_OUTAGE : null}
        cloneLog={scenario === "loading" ? CLONE_LOG : []}
        cloning={scenario === "loading"}
        tab={tab}
        onTab={onTab}
      />
    </Frame>
  );
}
