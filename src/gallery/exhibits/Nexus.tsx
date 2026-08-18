import { useRef } from "react";
import { NexusDossier } from "../../components/NexusDossier";
import { NexusTooltip } from "../../components/NexusTooltip";
import { LINEAR, commitDetail } from "../fixtures";
import { Frame, Pad, noop } from "../frame";
import type { Scenario } from "../scenario";

export function NexusTooltipExhibit({ scenario }: { scenario: Scenario }) {
  const node = LINEAR.nodes.at(-1)!;
  const tipRef = useRef<HTMLDivElement>(null);
  return (
    <Pad>
      <div className="relative h-40">
        <NexusTooltip
          node={node}
          tipRef={tipRef}
          body={scenario === "empty" ? null : "Keep the sacred river centered."}
          isPr={scenario === "success"}
          failed={scenario === "error"}
          onExpand={noop}
        />
      </div>
    </Pad>
  );
}

export function NexusDossierExhibit({ scenario }: { scenario: Scenario }) {
  const node = LINEAR.nodes.at(-1)!;
  return (
    <Frame>
      <NexusDossier
        node={node}
        detail={scenario === "loading" || scenario === "empty" ? null : commitDetail(node.id)}
        reviewers={scenario === "success" ? ["minuteman"] : undefined}
        reviewDecision={scenario === "success" ? "APPROVED" : null}
        checks={scenario === "error" ? "failure" : "success"}
        isPr={scenario === "success"}
        failed={scenario === "error"}
        onStow={noop}
        onSelectCommit={noop}
        onOpenFile={noop}
      />
    </Frame>
  );
}
