import { useCallback, useEffect, useRef, useState } from "react";
import { IdentityPicker, type IdentityChoice } from "@/ssh/IdentityPicker";
import {
  checkoutPullRequest,
  cloneRepository,
  fetchRemote,
  isDivergedError,
  isPassphraseError,
  isSshIdentityError,
  onCloneLog,
  pickCloneDestination,
  pickRepository,
  pullFfOnly,
  pushBranch,
  pushTag,
} from "@/remotes/api";
import { sshAddKey, sshAgentEnsure } from "@/ssh/api";
import { appendCloneLog } from "@/remotes/cloneLog";
import {
  loadRecentRepos,
  rememberRepo,
  removeRecentRepo,
  type RecentRepo,
} from "@/remotes/recentRepos";
import { cloneUrl, errMessage } from "@/app/helpers";
import type { LoadOptions } from "@/git/useRepoSession";
import type { AheadBehind, RemoteAuthArgs } from "@/remotes/types";
import type { RepoSummary } from "@/git/types";

type RemoteKind = "fetch" | "pull" | "push" | null;

type LoadAll = (path: string, options?: LoadOptions) => Promise<RepoSummary | null>;

export function useRemotes({
  repoPath,
  cloneProtocol,
  loadAll,
  setError,
  setBusy,
}: {
  repoPath: string | null;
  cloneProtocol: string;
  loadAll: LoadAll;
  setError: (message: string | null) => void;
  setBusy: (busy: boolean) => void;
}) {
  const [recent, setRecent] = useState<RecentRepo[]>(() => loadRecentRepos());
  const [remoteOp, setRemoteOp] = useState<RemoteKind>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [cloneLog, setCloneLog] = useState<string[]>([]);
  const [cloning, setCloning] = useState(false);
  const pendingRemote = useRef<{
    op: (args: RemoteAuthArgs) => Promise<unknown>;
    kind: RemoteKind;
  } | null>(null);
  const pendingClone = useRef<{ url: string; dest: string } | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onCloneLog((line) => {
      setCloneLog((lines) => appendCloneLog(lines, line));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const openRepo = useCallback(
    async (path: string, options?: LoadOptions) => {
      const summary = await loadAll(path, options);
      if (summary && !options?.quiet) setRecent(rememberRepo(summary.path));
      return summary;
    },
    [loadAll],
  );

  const browse = useCallback(async () => {
    try {
      const picked = await pickRepository();
      if (picked) await openRepo(picked);
    } catch (err) {
      setError(errMessage(err));
    }
  }, [openRepo, setError]);

  const runClone = useCallback(
    async (
      url: string,
      dest: string,
      auth?: Pick<
        RemoteAuthArgs,
        "keyPath" | "passphrase" | "rememberKey" | "rememberDefault" | "rememberPassphrase"
      >,
    ) => {
      setError(null);
      setCloning(true);
      try {
        const summary = await cloneRepository(url, dest, auth);
        await openRepo(summary.path);
      } catch (err) {
        if (isSshIdentityError(err) || isPassphraseError(err)) {
          pendingClone.current = { url, dest };
          pendingRemote.current = null;
          setIdentityOpen(true);
          return;
        }
        setError(errMessage(err));
      } finally {
        setCloning(false);
      }
    },
    [openRepo, setError],
  );

  const startClone = useCallback(
    async (input: string) => {
      try {
        const destRoot = await pickCloneDestination();
        if (!destRoot) return;
        const url = cloneUrl(input, cloneProtocol);
        const name = url.split("/").pop()?.replace(/\.git$/, "") ?? "repo";
        const dest = `${destRoot.replace(/[/\\]+$/, "")}/${name}`;
        setCloneLog([]);
        await runClone(url, dest);
      } catch (err) {
        setError(errMessage(err));
      }
    },
    [cloneProtocol, runClone, setError],
  );

  const runRemote = useCallback(
    async (
      op: (args: RemoteAuthArgs) => Promise<unknown>,
      extra?: Partial<RemoteAuthArgs>,
      kind: RemoteKind = null,
    ) => {
      if (!repoPath) return;
      const args: RemoteAuthArgs = { path: repoPath, remote: "origin", ...extra };
      try {
        setBusy(true);
        if (kind) setRemoteOp(kind);
        await op(args);
        await openRepo(repoPath, { keepSelection: true });
      } catch (err) {
        if (isSshIdentityError(err) || isPassphraseError(err)) {
          pendingRemote.current = { op, kind };
          setIdentityOpen(true);
          return;
        }
        if (isDivergedError(err)) {
          setError(
            "Variant diverged — local branch and origin have diverged; pull would not fast-forward.",
          );
          return;
        }
        setError(errMessage(err));
      } finally {
        setBusy(false);
        if (kind) setRemoteOp(null);
      }
    },
    [openRepo, repoPath, setBusy, setError],
  );

  const fetch = useCallback(
    () => void runRemote(fetchRemote, undefined, "fetch"),
    [runRemote],
  );
  const pull = useCallback(
    () => void runRemote(pullFfOnly, undefined, "pull"),
    [runRemote],
  );
  const push = useCallback(
    () => void runRemote(pushBranch, undefined, "push"),
    [runRemote],
  );

  const identityPicker = (
    <IdentityPicker
      open={identityOpen}
      onClose={() => {
        pendingClone.current = null;
        pendingRemote.current = null;
        setIdentityOpen(false);
      }}
      onChoose={async (choice: IdentityChoice) => {
        setIdentityOpen(false);
        if (choice.keyPath) {
          try {
            await sshAgentEnsure();
            await sshAddKey(choice.keyPath, choice.passphrase);
          } catch {
            /* OpenSSH can still use the key file via -i */
          }
        }
        const auth = {
          keyPath: choice.keyPath,
          passphrase: choice.passphrase,
          rememberKey: choice.rememberKey,
          rememberDefault: choice.rememberDefault,
          rememberPassphrase: choice.rememberPassphrase,
        };
        const clone = pendingClone.current;
        pendingClone.current = null;
        if (clone) {
          await runClone(clone.url, clone.dest, auth);
          return;
        }
        const pending = pendingRemote.current;
        pendingRemote.current = null;
        const op = pending?.op ?? pushBranch;
        await runRemote(op, auth, pending?.kind ?? "push");
      }}
    />
  );

  return {
    recent,
    removeRecent: (path: string) => setRecent(removeRecentRepo(path)),
    remoteOp,
    identityOpen,
    setIdentityOpen,
    cloneLog,
    cloning,
    browse,
    openRepo,
    startClone,
    runClone,
    runRemote,
    fetch,
    pull,
    push,
    pushTag: (name: string) => void runRemote((args) => pushTag(args, name)),
    checkoutPr: (number: number) => runRemote((args) => checkoutPullRequest(args, number)),
    pullBase: (base: string) => runRemote((args) => pullFfOnly(args, base), undefined, "pull"),
    identityPicker,
    resetRemotes: () => {
      pendingClone.current = null;
      pendingRemote.current = null;
      setRemoteOp(null);
      setIdentityOpen(false);
    },
  };
}

export type { AheadBehind };
