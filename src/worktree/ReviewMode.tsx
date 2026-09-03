import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { canReviseLastFiling } from "@/worktree/amendFiling";
import { composeCommitMessage } from "@/worktree/commitMessage";
import { cn } from "@/ui/cn";
import { btn, btnPrimary, btnStow, emptyText, eyebrow, fieldInput, fieldLabel } from "@/ui/ui";
import type { AheadBehind, RemoteInfo } from "@/remotes/types";
import type { FileChange } from "@/git/types";
import type { StatusPayload } from "@/worktree/types";
import { AnomalyColumnSkeleton } from "@/ui/TvaSkeleton";
import { TransmitButton } from "@/ui/TransmitButton";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { TvaTerm } from "@/ui/TvaTerm";
import { PierreFileTree } from "@/diff/PierreFileTree";

export type AnomalySide = "staged" | "unstaged";

interface Props {
  status: StatusPayload | null;
  selected: { side: AnomalySide; path: string } | null;
  onOpenFile: (side: AnomalySide, path: string) => void;
  onStage: (path: string) => void | Promise<void>;
  onUnstage: (path: string) => void | Promise<void>;
  onCommit: (message: string, amend: boolean) => Promise<void>;
  busy: boolean;
  fetching?: boolean;
  pulling?: boolean;
  pushing?: boolean;
  /** Tour / demo: push already completed. */
  pushed?: boolean;
  sync?: AheadBehind | null;
  onBranch?: boolean;
  hasHead?: boolean;
  headFiling?: { summary: string; body: string } | null;
  includeTagsOnPush?: boolean;
  onIncludeTagsOnPush?: (next: boolean) => void;
  remotes?: RemoteInfo[];
  selectedRemote?: string | null;
  onSelectRemote?: (name: string) => void;
  onManageRemotes?: () => void;
  onPush: () => void;
  onFetch: () => void;
  onPull: () => void;
  children?: ReactNode;
  /** Narrower columns and tighter chrome for marketing-site embeds. */
  compact?: boolean;
  /**
   * `columns` — desktop three-pane desk (default).
   * `stack` — one pane at a time with Anomalies / Diff / Case segments (mobile preview).
   */
  layout?: "columns" | "stack";
}

type StackPane = "anomalies" | "diff" | "case";

export function ReviewMode({
  status,
  selected,
  onOpenFile,
  onStage,
  onUnstage,
  onCommit,
  busy,
  fetching = false,
  pulling = false,
  pushing = false,
  pushed = false,
  sync = null,
  onBranch = false,
  hasHead = false,
  headFiling = null,
  includeTagsOnPush = false,
  onIncludeTagsOnPush,
  remotes,
  selectedRemote = null,
  onSelectRemote,
  onManageRemotes,
  onPush,
  onFetch,
  onPull,
  children,
  compact = false,
  layout = "columns",
}: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amend, setAmend] = useState(false);
  const [filing, setFiling] = useState(false);
  const [stackPane, setStackPane] = useState<StackPane>("anomalies");
  const loading = status == null;
  const staged = status?.staged ?? [];
  const unfiled = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
  const message = composeCommitMessage(title, body);
  const hasSubject = Boolean(title.trim());
  const canRevise = canReviseLastFiling(sync, onBranch, hasHead);
  const ahead = sync?.ahead ?? 0;
  const canFile = !busy && hasSubject && (amend ? canRevise : staged.length > 0);
  const stacked = layout === "stack";
  const gated = remotes !== undefined;
  const canTransmit = !gated || Boolean(selectedRemote);
  const remoteLabel = selectedRemote ?? "origin";

  useEffect(() => {
    if (amend && !canRevise) setAmend(false);
  }, [amend, canRevise]);

  useEffect(() => {
    if (!amend || !headFiling) return;
    setTitle((current) => (current.trim() ? current : headFiling.summary.slice(0, 72)));
    setBody((current) => (current.trim() ? current : headFiling.body));
  }, [amend, headFiling]);

  useEffect(() => {
    if (!stacked || !selected) return;
    setStackPane("diff");
  }, [stacked, selected?.side, selected?.path]);

  const runAll = useCallback(async (paths: string[], act: (path: string) => void | Promise<void>) => {
    for (const path of paths) {
      await act(path);
    }
  }, []);

  function toggleAmend(checked: boolean) {
    setAmend(checked);
  }

  async function submit() {
    if (!canFile || filing) return;
    setFiling(true);
    try {
      await onCommit(message, amend);
      setTitle("");
      setBody("");
      setAmend(false);
    } finally {
      setFiling(false);
    }
  }

  const anomalies = (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-[#1b1713]",
        stacked ? "h-full min-h-0 flex-1" : "border-r border-tva-gold/16",
      )}
    >
      <Column
        title="UNFILED"
        side="unstaged"
        items={unfiled}
        action="file"
        selectedPath={selected?.side === "unstaged" ? selected.path : null}
        onOpen={onOpenFile}
        onClick={onStage}
        onAll={() => runAll(unfiled.map((item) => item.path), onStage)}
        loading={loading}
        empty="No unfiled variance."
        compact={compact}
      />
      <Column
        title="FILED (STAGED)"
        side="staged"
        items={staged}
        action="unfile"
        selectedPath={selected?.side === "staged" ? selected.path : null}
        onOpen={onOpenFile}
        onClick={onUnstage}
        onAll={() => runAll(staged.map((item) => item.path), onUnstage)}
        loading={loading}
        empty="Nothing staged for filing."
        compact={compact}
      />
    </aside>
  );

  const diffPane = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#16120e]",
        stacked && "h-full flex-1",
      )}
    >
      {children ? (
        children
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e] px-6">
          <p className={eyebrow}>Review desk</p>
          <p className={cn(emptyText, "mt-2")}>Select an unfiled or filed record.</p>
        </div>
      )}
    </div>
  );

  const caseForm = (
    <form
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-[#16120e]",
        stacked ? "h-full flex-1" : "border-l border-tva-gold/16",
        compact ? "gap-2.5 px-4 pt-3.5 pb-4" : "gap-2.5 px-[18px] pt-4 pb-[18px]",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e: ReactKeyboardEvent<HTMLFormElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">CASE NOTE</h3>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Subject</span>
        <input
          className={fieldInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subject of this filing"
          maxLength={72}
          autoComplete="off"
        />
      </label>
      <label className="flex min-h-0 flex-1 flex-col gap-1.5">
        <span className={fieldLabel}>Addendum</span>
        <textarea
          className={cn(
            fieldInput,
            "flex-1 resize-none leading-[1.45]",
            compact ? "min-h-[6rem]" : "min-h-[7rem]",
          )}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional case note for this filing"
        />
      </label>
      <label className="flex items-center gap-2.5 text-[11px] text-tva-muted">
        <input
          type="checkbox"
          checked={amend}
          disabled={!canRevise}
          onChange={(e) => toggleAmend(e.target.checked)}
        />
        Revise last filing
      </label>
      {!canRevise && hasHead && onBranch ? (
        <p className="m-0 text-[11px] text-tva-muted">Last filing already uploaded to HQ</p>
      ) : null}
      <p className="m-0 text-[11px] text-tva-muted">
        {amend
          ? staged.length
            ? `${staged.length} record${staged.length === 1 ? "" : "s"} will fold into the last filing`
            : "Case note only — no new records staged"
          : staged.length
            ? `${staged.length} record${staged.length === 1 ? "" : "s"} ready to file`
            : "File at least one record before submitting"}
      </p>
      <TransmitButton
        active={filing}
        disabled={!canFile}
        idleClass={btnPrimary}
        onClick={() => void submit()}
        title={amend ? "Amend last filing" : "File variant"}
        label={amend ? "Revising…" : "Filing…"}
        flavor={amend ? "Revise last filing" : "File variant"}
        noun={amend ? "Amend" : "File variant"}
        busyNoun={amend ? "Revising…" : "Filing…"}
        onPrimary
      />
      <div className="mt-auto flex flex-col gap-2 border-t border-tva-gold/16 pt-3">
        {remotes !== undefined || onManageRemotes ? (
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.14em] text-tva-muted">Remote</span>
              <select
                className={fieldInput}
                value={selectedRemote ?? ""}
                disabled={busy || !remotes?.length}
                onChange={(e) => onSelectRemote?.(e.target.value)}
                aria-label="Transmit remote"
              >
                {(remotes ?? []).length === 0 ? (
                  <option value="">No remotes</option>
                ) : (
                  (remotes ?? []).map((remote) => (
                    <option key={remote.name} value={remote.name}>
                      {remote.name}
                      {remote.transport === "ssh" ? " · ssh" : remote.transport === "https" ? " · https" : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            {onManageRemotes ? (
              <button type="button" className={btnStow} disabled={busy} onClick={onManageRemotes}>
                Manage remotes…
              </button>
            ) : null}
          </div>
        ) : null}
        <TransmitButton
          active={fetching}
          disabled={busy || !canTransmit}
          idleClass={btn}
          onClick={onFetch}
          title={`Fetch from ${remoteLabel}`}
          label="Fetching…"
          flavor="Dispatch"
          noun="Fetch"
          busyNoun="Fetching…"
        />
        <TransmitButton
          active={pulling}
          disabled={busy || !canTransmit}
          idleClass={btn}
          onClick={onPull}
          title={`Fast-forward pull from ${remoteLabel}`}
          label="Pulling…"
          flavor="Sync inbound"
          noun="Pull"
          busyNoun="Pulling…"
        />
        {onIncludeTagsOnPush ? (
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeTagsOnPush}
              disabled={busy || pushed}
              onChange={(e) => onIncludeTagsOnPush(e.target.checked)}
            />
            <TvaTerm flavor="Also dispatch seals" noun="Include tags on push" />
          </label>
        ) : null}
        <TransmitButton
          active={pushing}
          disabled={busy || pushed || !canTransmit}
          idleClass={ahead > 0 && !pushed ? btnPrimary : btn}
          onClick={onPush}
          title={
            includeTagsOnPush
              ? `Push branch and tags to ${remoteLabel}`
              : `Push branch to ${remoteLabel}`
          }
          label="Pushing…"
          flavor={
            pushed
              ? "Uploaded to HQ"
              : ahead > 0
                ? `Upload to HQ · ${ahead} ahead`
                : "Upload to HQ"
          }
          noun={pushed ? "Pushed" : "Push"}
          busyNoun="Pushing…"
          onPrimary={ahead > 0 && !pushed}
        />
      </div>
    </form>
  );

  if (stacked) {
    return (
      <div data-workspace className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 border-b border-tva-gold/16 bg-[#1b1713]" role="tablist" aria-label="Review panes">
          {(
            [
              { id: "anomalies", label: "Anomalies" },
              { id: "diff", label: "Diff" },
              { id: "case", label: "Case" },
            ] as const
          ).map((pane) => (
            <button
              key={pane.id}
              type="button"
              role="tab"
              aria-selected={stackPane === pane.id}
              className={cn(
                "min-h-11 flex-1 border-0 border-b-2 bg-transparent px-2 py-2.5 text-[0.625rem] uppercase tracking-[0.14em]",
                stackPane === pane.id
                  ? "border-tva-orange text-tva-gold-bright"
                  : "border-transparent text-tva-muted",
              )}
              onClick={() => setStackPane(pane.id)}
            >
              {pane.label}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" role="tabpanel">
          {stackPane === "anomalies" ? anomalies : null}
          {stackPane === "diff" ? diffPane : null}
          {stackPane === "case" ? caseForm : null}
        </div>
      </div>
    );
  }

  return (
    <div
      data-workspace
      className={cn(
        "grid min-h-0 flex-1 overflow-hidden",
        compact
          ? "grid-cols-[280px_minmax(0,1fr)_280px]"
          : "grid-cols-[260px_minmax(0,1fr)_320px]",
      )}
    >
      {anomalies}
      {diffPane}
      {caseForm}
    </div>
  );
}

function Column({
  title,
  side,
  items,
  action,
  selectedPath,
  onOpen,
  onClick,
  onAll,
  loading,
  empty,
  compact = false,
}: {
  title: string;
  side: AnomalySide;
  items: FileChange[];
  action: "file" | "unfile";
  selectedPath: string | null;
  onOpen: (side: AnomalySide, path: string) => void;
  onClick: (path: string) => void | Promise<void>;
  onAll: () => void;
  loading: boolean;
  empty: string;
  compact?: boolean;
}) {
  const verb = action === "file" ? "File" : "Unfile";
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col border-b border-tva-gold/12 last:border-b-0",
        compact ? "py-2.5 pr-2.5 pl-3" : "py-3 pr-2.5 pl-3.5",
      )}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
          {title} <span className="text-tva-muted">{loading ? "…" : items.length}</span>
        </h3>
        <button
          type="button"
          className={compact ? btnStow : btn}
          disabled={loading || items.length === 0}
          onClick={onAll}
        >
          {verb} all
        </button>
      </div>
      {loading ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <AnomalyColumnSkeleton />
        </TvaScrollArea>
      ) : items.length === 0 ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>{empty}</div>
        </TvaScrollArea>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <PierreFileTree
            files={items}
            selectedPath={selectedPath}
            onSelectPath={(path) => onOpen(side, path)}
            action={{ label: verb, onAction: onClick }}
          />
        </div>
      )}
    </div>
  );
}
