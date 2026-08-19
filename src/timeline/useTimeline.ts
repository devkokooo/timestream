import { useEffect, useMemo, useState } from "react";
import { getCommit } from "@/timeline/api";
import { keepIfSame } from "@/app/helpers";
import type { CommitDetail, RailTab, Timeline } from "@/timeline/types";

export function useTimeline({
  repoPath,
  timeline,
  selectedId,
}: {
  repoPath: string | null;
  timeline: Timeline | null;
  selectedId: string | null;
}) {
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [railTab, setRailTab] = useState<RailTab>("variants");
  const [variantRailOpen, setVariantRailOpen] = useState(true);
  const [docketOpen, setDocketOpen] = useState(true);

  useEffect(() => {
    if (!repoPath || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail((current) => (current?.id === selectedId ? current : null));
    getCommit(repoPath, selectedId)
      .then((next) => {
        if (!cancelled) setDetail((prev) => (prev ? keepIfSame(prev, next) : next));
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, selectedId]);

  const selectedNode = useMemo(
    () => timeline?.nodes.find((n) => n.id === selectedId) ?? null,
    [timeline, selectedId],
  );

  return {
    detail,
    railTab,
    setRailTab,
    variantRailOpen,
    setVariantRailOpen,
    docketOpen,
    setDocketOpen,
    selectedNode,
    resetRails: () => {
      setRailTab("variants");
      setDetail(null);
    },
  };
}
