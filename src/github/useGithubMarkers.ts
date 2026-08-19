import { useEffect, useMemo, useState } from "react";
import { githubListPulls } from "@/github/pulls/api";
import { githubListReviewComments } from "@/github/reviews/api";
import { errMessage } from "@/app/helpers";
import type { ForgeUser } from "@/auth/types";
import type { RemoteInfo } from "@/remotes/types";
import type { PullRequestSummary } from "@/github/pulls/types";
import type { ReviewComment } from "@/github/reviews/types";

export function useGithubMarkers({
  origin,
  user,
  setError,
}: {
  origin: RemoteInfo | null;
  user: ForgeUser | null;
  setError: (message: string | null) => void;
}) {
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [hqOpen, setHqOpen] = useState(false);

  useEffect(() => {
    if (!origin?.owner || !origin.nameOnHost || !user) {
      setPrs([]);
      return;
    }
    void githubListPulls(origin.owner, origin.nameOnHost, "open")
      .then(setPrs)
      .catch((err) => {
        setPrs([]);
        setError(errMessage(err));
      });
  }, [origin?.owner, origin?.nameOnHost, setError, user]);

  const prByBranch = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pr of prs) map[pr.headRef] = pr.number;
    return map;
  }, [prs]);
  const prHeadShas = useMemo(() => new Set(prs.map((p) => p.headSha)), [prs]);
  const failingShas = useMemo(
    () => new Set(prs.filter((p) => p.ciStatus === "failure").map((p) => p.headSha)),
    [prs],
  );

  const loadReviewComments = (sha: string | null) => {
    const pr = prs.find((p) => p.headSha === sha);
    if (pr && origin?.owner && origin.nameOnHost) {
      void githubListReviewComments(origin.owner, origin.nameOnHost, pr.number)
        .then(setReviewComments)
        .catch((err) => {
          setReviewComments([]);
          setError(errMessage(err));
        });
    }
  };

  return {
    prs,
    setPrs,
    reviewComments,
    hqOpen,
    setHqOpen,
    prByBranch,
    prHeadShas,
    failingShas,
    loadReviewComments,
    resetGithub: () => {
      setPrs([]);
      setReviewComments([]);
      setHqOpen(false);
    },
  };
}
