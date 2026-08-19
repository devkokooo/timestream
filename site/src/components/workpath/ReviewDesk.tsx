import { useState } from "react";
import { DiffViewer } from "../../../../src/diff/DiffViewer";
import { ReviewMode } from "../../../../src/worktree/ReviewMode";
import type { AnomalySide } from "../../../../src/worktree/ReviewMode";
import type { DiffMode } from "../../../../src/diff/types";
import type { FileChange } from "../../../../src/git/types";
import type { StatusPayload } from "../../../../src/worktree/types";
import { fileDiffFor, INITIAL_STATUS, REVIEW_FILES, SYNC } from "../../lib/tourData";

function cloneStatus(status: StatusPayload): StatusPayload {
  return {
    staged: [...status.staged],
    unstaged: [...status.unstaged],
    untracked: [...status.untracked],
  };
}

const UNTRACKED = new Set(INITIAL_STATUS.untracked.map((file) => file.path));

function takeFile(status: StatusPayload, path: string): FileChange | null {
  for (const side of ["staged", "unstaged", "untracked"] as const) {
    const index = status[side].findIndex((file) => file.path === path);
    if (index >= 0) return status[side].splice(index, 1)[0];
  }
  return null;
}

function asStaged(file: FileChange): FileChange {
  return file.status === "untracked" ? { ...file, status: "added" } : file;
}

function asUnfiled(file: FileChange): FileChange {
  return UNTRACKED.has(file.path) ? { ...file, status: "untracked" } : file;
}

function stagePath(status: StatusPayload, path: string): StatusPayload {
  const next = cloneStatus(status);
  const file = takeFile(next, path);
  if (file) next.staged.push(asStaged(file));
  return next;
}

function findFile(status: StatusPayload, path: string): FileChange | null {
  return (
    status.staged.find((file) => file.path === path) ??
    status.unstaged.find((file) => file.path === path) ??
    status.untracked.find((file) => file.path === path) ??
    null
  );
}

export function ReviewDesk() {
  const [status, setStatus] = useState(() => cloneStatus(INITIAL_STATUS));
  const [selected, setSelected] = useState<{ side: AnomalySide; path: string } | null>({
    side: "staged",
    path: REVIEW_FILES[0].path,
  });
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [sync, setSync] = useState(SYNC);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");

  const selectedFile = selected ? findFile(status, selected.path) : null;
  const diff = selectedFile ? fileDiffFor(selectedFile.path, selectedFile.status) : null;

  function pulse(setFlag: (value: boolean) => void, ms = 900) {
    setFlag(true);
    window.setTimeout(() => setFlag(false), ms);
  }

  return (
    <ReviewMode
      compact
      status={status}
      selected={selected}
      onOpenFile={(side, path) => setSelected({ side, path })}
      onStage={async (path) => {
        setStatus((prev) => stagePath(prev, path));
        setSelected({ side: "staged", path });
      }}
      onUnstage={async (path) => {
        setStatus((prev) => {
          const next = cloneStatus(prev);
          const file = takeFile(next, path);
          if (!file) return prev;
          const restored = asUnfiled(file);
          if (UNTRACKED.has(path)) next.untracked.push(restored);
          else next.unstaged.push(restored);
          return next;
        });
        setSelected({ side: "unstaged", path });
      }}
      onCommit={async () => {
        setBusy(true);
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        setStatus((prev) => ({ ...prev, staged: [] }));
        setSelected(null);
        setBusy(false);
      }}
      busy={busy}
      fetching={fetching}
      pulling={pulling}
      pushing={pushing}
      pushed={pushed}
      sync={sync}
      onBranch
      hasHead
      headFiling={{ summary: "Keep the sacred river centered.", body: "" }}
      onPush={() => {
        if (pushing || pushed) return;
        setPushing(true);
        window.setTimeout(() => {
          setPushing(false);
          setPushed(true);
          setSync((prev) => ({ ...prev, ahead: 0 }));
        }, 1100);
      }}
      onFetch={() => pulse(setFetching)}
      onPull={() => pulse(setPulling)}
    >
      {selected && selectedFile ? (
        <DiffViewer
          compact
          file={selectedFile}
          diff={diff}
          mode={diffMode}
          error={null}
          onMode={setDiffMode}
          onClose={() => setSelected(null)}
          onFile={
            selected.side === "unstaged"
              ? async () => {
                  setStatus((prev) => stagePath(prev, selected.path));
                  setSelected({ side: "staged", path: selected.path });
                }
              : undefined
          }
        />
      ) : null}
    </ReviewMode>
  );
}
