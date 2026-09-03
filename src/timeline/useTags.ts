import { useCallback, useState } from "react";
import { createLocalTag, deleteLocalTag } from "@/timeline/api";
import type { SealTarget } from "@/timeline/SealDesk";
import type { LoadOptions } from "@/git/useRepoSession";
import type { RepoSummary } from "@/git/types";
import { errMessage } from "@/app/helpers";

export function useTags({
  repo,
  loadAll,
  setBusy,
  setError,
  pushTag,
}: {
  repo: RepoSummary | null;
  loadAll: (path: string, options?: LoadOptions) => Promise<RepoSummary | null>;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  pushTag: (name: string) => Promise<void>;
}) {
  const [sealTarget, setSealTarget] = useState<SealTarget | null>(null);
  const [dispatchDefault, setDispatchDefault] = useState(false);
  const [pendingCull, setPendingCull] = useState<string | null>(null);

  const openSealDesk = useCallback((target: SealTarget) => {
    setSealTarget(target);
  }, []);

  const closeSealDesk = useCallback(() => {
    setSealTarget(null);
  }, []);

  const requestCull = useCallback((name: string) => {
    setPendingCull(name);
  }, []);

  const cancelCull = useCallback(() => {
    setPendingCull(null);
  }, []);

  const create = useCallback(
    async (name: string, sha: string, message: string | undefined, push: boolean) => {
      if (!repo) return;
      setBusy(true);
      try {
        await createLocalTag(repo.path, name, sha, message);
        if (push) {
          await pushTag(name);
        } else {
          await loadAll(repo.path, { keepSelection: true });
        }
        setSealTarget(null);
      } catch (err) {
        setBusy(false);
        throw err instanceof Error ? err : new Error(errMessage(err));
      }
    },
    [loadAll, pushTag, repo, setBusy],
  );

  const remove = useCallback(
    async (name: string) => {
      if (!repo) return;
      setBusy(true);
      try {
        await deleteLocalTag(repo.path, name);
        await loadAll(repo.path, { keepSelection: true });
        setPendingCull(null);
      } catch (err) {
        setError(errMessage(err));
        setBusy(false);
      }
    },
    [loadAll, repo, setBusy, setError],
  );

  return {
    sealTarget,
    sealDeskOpen: sealTarget !== null,
    openSealDesk,
    closeSealDesk,
    dispatchDefault,
    setDispatchDefault,
    create,
    remove,
    requestCull,
    cancelCull,
    pendingCull,
  };
}
