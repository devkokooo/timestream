import { useCallback, useState } from "react";
import {
  createLocalBranch,
  deleteLocalBranch,
  renameLocalBranch,
  switchBranch,
} from "@/branches/api";
import type { LoadOptions } from "@/git/useRepoSession";
import type { RepoSummary } from "@/git/types";

export function useBranches({
  repo,
  loadAll,
  setBusy,
}: {
  repo: RepoSummary | null;
  loadAll: (path: string, options?: LoadOptions) => Promise<RepoSummary | null>;
  setBusy: (busy: boolean) => void;
}) {
  const [branchDeskOpen, setBranchDeskOpen] = useState(false);

  const runLocalBranch = useCallback(
    async (op: () => Promise<void>) => {
      setBusy(true);
      try {
        await op();
      } catch (err) {
        setBusy(false);
        throw err;
      }
    },
    [setBusy],
  );

  return {
    branchDeskOpen,
    setBranchDeskOpen,
    switchTo: async (name: string) => {
      if (!repo) return;
      await runLocalBranch(async () => {
        await switchBranch(repo.path, name);
        await loadAll(repo.path);
        setBranchDeskOpen(false);
      });
    },
    create: async (name: string, checkout: boolean) => {
      if (!repo) return;
      await runLocalBranch(async () => {
        await createLocalBranch(repo.path, name, checkout);
        await loadAll(repo.path, { keepSelection: !checkout });
        if (checkout) setBranchDeskOpen(false);
      });
    },
    rename: async (from: string, to: string) => {
      if (!repo) return;
      await runLocalBranch(async () => {
        await renameLocalBranch(repo.path, from, to);
        await loadAll(repo.path, { keepSelection: true });
      });
    },
    remove: async (name: string) => {
      if (!repo) return;
      await runLocalBranch(async () => {
        await deleteLocalBranch(repo.path, name);
        await loadAll(repo.path, { keepSelection: true });
      });
    },
  };
}
