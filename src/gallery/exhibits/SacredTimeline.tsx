import { useState } from "react";
import { SacredTimeline } from "@/timeline/SacredTimeline";
import { MANY_BRANCHES, commitDetail, emptyTimeline } from "../fixtures";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function SacredTimelineExhibit({ scenario }: { scenario: Scenario }) {
  const timeline = scenario === "empty" ? emptyTimeline() : MANY_BRANCHES;
  const selected = timeline.nodes.at(-1)?.id ?? null;
  const [id, setId] = useState(selected);
  const nodeId = id && timeline.nodes.some((n) => n.id === id) ? id : selected;
  return (
    <Frame>
      <SacredTimeline
        timeline={timeline}
        selectedId={nodeId}
        onSelect={setId}
        detail={scenario === "loading" || !nodeId ? null : commitDetail(nodeId)}
        onSelectCommit={noop}
        onOpenFile={noop}
      />
    </Frame>
  );
}
