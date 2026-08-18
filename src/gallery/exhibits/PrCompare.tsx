import { PrCompare } from "../../components/PrCompare";
import { MANY_BRANCHES, REPO } from "../fixtures";
import { Frame, noop } from "../frame";

export function PrCompareExhibit() {
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
      />
    </Frame>
  );
}
