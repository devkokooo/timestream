import { Docket } from "@/timeline/Docket";
import { LINEAR, commitDetail } from "../fixtures";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function DocketExhibit({ scenario }: { scenario: Scenario }) {
  const node = scenario === "empty" ? null : LINEAR.nodes.at(-1)!;
  const detail =
    scenario === "loading" || !node ? null : scenario === "error" ? commitDetail("missing") : commitDetail(node.id);
  return (
    <Frame>
      <Docket
        node={node}
        detail={detail}
        selectedPath={scenario === "success" ? "src/lib/graph.rs" : null}
        onOpenFile={noop}
        onSelectCommit={noop}
        selectedSha={node?.id ?? null}
        checksBySha={node ? { [node.id]: "success" } : {}}
        onStow={noop}
      />
    </Frame>
  );
}
