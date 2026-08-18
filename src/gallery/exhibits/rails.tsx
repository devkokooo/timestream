import { HistoryRail } from "../../components/HistoryRail";
import { LeftRail } from "../../components/LeftRail";
import { TagsRail } from "../../components/TagsRail";
import { VariantRail } from "../../components/VariantRail";
import type { RailTab } from "../../lib/types";
import { LINEAR, MANY_BRANCHES, SYNC, TAGGED, emptyTimeline } from "../fixtures";
import { Frame, noop } from "../frame";
import { useExhibitTab } from "../exhibitUi";
import type { Scenario } from "../scenario";

export function VariantRailExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame>
      <VariantRail
        timeline={scenario === "empty" ? emptyTimeline() : MANY_BRANCHES}
        onCheckout={noop}
        busy={scenario === "loading"}
        prByBranch={scenario === "success" ? { "var-1": 12 } : undefined}
        aheadBehind={scenario === "error" ? SYNC : null}
      />
    </Frame>
  );
}

export function HistoryRailExhibit({ scenario }: { scenario: Scenario }) {
  const timeline = scenario === "empty" ? emptyTimeline() : LINEAR;
  return (
    <Frame>
      <HistoryRail timeline={timeline} selectedId={timeline.nodes.at(-1)?.id ?? null} onSelect={noop} />
    </Frame>
  );
}

export function TagsRailExhibit({ scenario }: { scenario: Scenario }) {
  const timeline = scenario === "empty" ? emptyTimeline() : TAGGED;
  return (
    <Frame>
      <TagsRail timeline={timeline} selectedId={timeline.nodes.at(-1)?.id ?? null} onSelect={noop} />
    </Frame>
  );
}

export function LeftRailExhibit({ scenario }: { scenario: Scenario }) {
  const [tab, setTab] = useExhibitTab<RailTab>("left-rail", "variants");
  const timeline = scenario === "empty" ? emptyTimeline() : MANY_BRANCHES;
  return (
    <Frame>
      <LeftRail
        tab={tab}
        onTab={setTab}
        timeline={timeline}
        selectedId={timeline.nodes.at(-1)?.id ?? null}
        onSelectTag={noop}
        onCheckout={noop}
        onStow={noop}
        busy={scenario === "loading"}
        prByBranch={{ feature: 12 }}
        aheadBehind={SYNC}
        branch="main"
      />
    </Frame>
  );
}
