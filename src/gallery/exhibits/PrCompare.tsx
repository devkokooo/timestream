import { PrCompare, type RequestDeskTab } from "@/github/pulls/PrCompare";
import { MANY_BRANCHES, REPO } from "../fixtures";
import { Frame, noop } from "../frame";
import { useExhibitTab } from "../exhibitUi";

export function PrCompareExhibit() {
  const [tab, onTab] = useExhibitTab<RequestDeskTab>("pr-compare", "conversation");
  return (
    <Frame>
      <PrCompare
        repoPath={REPO.path}
        timeline={MANY_BRANCHES}
        currentBranch="feature"
        sacredBranch="main"
        head="feature"
        base="main"
        extraBranches={["grain"]}
        onHead={noop}
        onBase={noop}
        tab={tab}
        onTab={onTab}
      />
    </Frame>
  );
}
