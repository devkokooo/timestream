import { useMemo, useState } from "react";
import { DocketFeed } from "../../../../src/components/DocketFeed";
import { PrCompare } from "../../../../src/components/PrCompare";
import { GithubUserProvider } from "../../../../src/lib/githubUserContext";
import { buildPrDocket, collapseCommitRuns } from "../../../../src/lib/prDocket";
import { stamp, stampGold } from "../../../../src/lib/ui";
import { cn } from "../../../../src/lib/cn";
import {
  HEAD_VARIANT,
  PR2,
  PR2_COMMENTS,
  PR2_COMMITS,
  PR2_REVIEWS,
  PR2_TIMELINE,
  REPO_PATH,
  SACRED,
  TOUR_USER,
} from "../../lib/tourData";

export function PrDesk() {
  const [head, setHead] = useState(HEAD_VARIANT);
  const [base, setBase] = useState(SACRED);
  const docket = useMemo(
    () => collapseCommitRuns(buildPrDocket(PR2, PR2_COMMITS, PR2_COMMENTS, PR2_REVIEWS, [])),
    [],
  );

  return (
    <GithubUserProvider user={TOUR_USER}>
      <PrCompare
        compact
        repoPath={REPO_PATH}
        timeline={PR2_TIMELINE}
        currentBranch={HEAD_VARIANT}
        sacredBranch={SACRED}
        head={head}
        base={base}
        onHead={setHead}
        onBase={setBase}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className={cn(stamp, stampGold)}>MERGED</span>
          <span className="text-[0.625rem] uppercase tracking-[0.12em] text-tva-muted">
            {PR2.headRef} → {PR2.baseRef}
          </span>
        </div>
        <h3 className="m-0 text-sm text-tva-paper">
          <span className="text-tva-muted">#{PR2.number}</span> {PR2.title}
        </h3>
        <p className="mt-3 mb-1 text-[0.625rem] uppercase tracking-[0.12em] text-tva-gold">
          Docket · Conversation
        </p>
        <DocketFeed entries={docket} />
      </PrCompare>
    </GithubUserProvider>
  );
}
