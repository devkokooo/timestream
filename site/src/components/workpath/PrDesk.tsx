import { useEffect, useMemo, useState } from "react";
import { DocketFeed } from "../../../../src/github/pulls/DocketFeed";
import { PrCompare } from "../../../../src/github/pulls/PrCompare";
import { AuthProvider } from "../../../../src/auth/AuthProvider";
import { buildPrDocket, collapseCommitRuns } from "../../../../src/github/pulls/prDocket";
import { stamp, stampGold } from "../../../../src/ui/ui";
import { cn } from "../../../../src/ui/cn";
import type { DiffMode } from "../../../../src/diff/types";
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
import { useIsNarrow } from "../../lib/useIsNarrow";

export function PrDesk() {
  const narrow = useIsNarrow();
  const [head, setHead] = useState(HEAD_VARIANT);
  const [base, setBase] = useState(SACRED);
  const [diffMode, setDiffMode] = useState<DiffMode>(narrow ? "inline" : "split");
  const docket = useMemo(
    () => collapseCommitRuns(buildPrDocket(PR2, PR2_COMMITS, PR2_COMMENTS, PR2_REVIEWS, [])),
    [],
  );

  useEffect(() => {
    setDiffMode(narrow ? "inline" : "split");
  }, [narrow]);

  return (
    <AuthProvider user={TOUR_USER}>
      <PrCompare
        compact
        layout={narrow ? "stack" : "columns"}
        diffMode={diffMode}
        onDiffMode={setDiffMode}
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
    </AuthProvider>
  );
}
