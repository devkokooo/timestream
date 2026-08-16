import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { canReviseLastFiling } from "../lib/amendFiling";
import { composeCommitMessage } from "../lib/commitMessage";
import { cn } from "../lib/cn";
import { actionMark, actionMarkTitle, actionTone, fileDisplayName, fileDisplayPath } from "../lib/diffView";
import { isTestFile } from "../lib/fileKind";
import {
  actionColor,
  btn,
  btnPrimary,
  btnTransmit,
  emptyText,
  eyebrow,
  fieldInput,
  fieldLabel,
  fileRowPad,
  fileRowSelected,
  TEST_FILE_HEX,
} from "../lib/ui";
import type { AheadBehind, FileChange, StatusPayload } from "../lib/types";
import { FileKindIcon } from "./FileKindIcon";
import { AnomalyColumnSkeleton } from "./TvaSkeleton";
import { TvaJumble } from "./TvaJumble";
import { TvaTerm } from "./TvaTerm";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

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
  sync?: AheadBehind | null;
  onBranch?: boolean;
  hasHead?: boolean;
  headFiling?: { summary: string; body: string } | null;
  onPush: () => void;
  onFetch: () => void;
  onPull: () => void;
  children?: ReactNode;
}

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
  sync = null,
  onBranch = false,
  hasHead = false,
  headFiling = null,
  onPush,
  onFetch,
  onPull,
  children,
}: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amend, setAmend] = useState(false);
  const loading = status == null;
  const staged = status?.staged ?? [];
  const unfiled = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
  const message = composeCommitMessage(title, body);
  const hasSubject = Boolean(title.trim());
  const canRevise = canReviseLastFiling(sync, onBranch, hasHead);
  const ahead = sync?.ahead ?? 0;
  const canFile = !busy && hasSubject && (amend ? canRevise : staged.length > 0);

  useEffect(() => {
    if (amend && !canRevise) setAmend(false);
  }, [amend, canRevise]);

  useEffect(() => {
    if (!amend || !headFiling) return;
    setTitle((current) => (current.trim() ? current : headFiling.summary.slice(0, 72)));
    setBody((current) => (current.trim() ? current : headFiling.body));
  }, [amend, headFiling]);

  const runAll = useCallback(async (paths: string[], act: (path: string) => void | Promise<void>) => {
    for (const path of paths) {
      await act(path);
    }
  }, []);

  function toggleAmend(checked: boolean) {
    setAmend(checked);
  }

  async function submit() {
    if (!canFile) return;
    await onCommit(message, amend);
    setTitle("");
    setBody("");
    setAmend(false);
  }

  return (
    <div
      data-workspace
      className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px]"
    >
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
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
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#16120e]">
        {children ? (
          children
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e] px-6">
            <p className={eyebrow}>Review desk</p>
            <p className={cn(emptyText, "mt-2")}>Select an unfiled or filed record.</p>
          </div>
        )}
      </div>

      <form
        className="flex min-h-0 flex-col gap-2.5 overflow-hidden border-l border-tva-gold/16 bg-[#16120e] px-[18px] pt-4 pb-[18px]"
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
            className={cn(fieldInput, "min-h-[7rem] flex-1 resize-none leading-[1.45]")}
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
        <button className={btnPrimary} type="submit" disabled={!canFile}>
          {amend ? (
            <TvaTerm flavor="Revise last filing" noun="Amend" onPrimary />
          ) : (
            "File variant"
          )}
        </button>
        <div className="mt-auto flex flex-col gap-2 border-t border-tva-gold/16 pt-3">
          <TransmitButton
            active={fetching}
            disabled={busy}
            idleClass={btn}
            onClick={onFetch}
            title="Fetch from origin"
            label="Fetching…"
            flavor="Dispatch"
            noun="Fetch"
            busyNoun="Fetching…"
          />
          <TransmitButton
            active={pulling}
            disabled={busy}
            idleClass={btn}
            onClick={onPull}
            title="Fast-forward pull"
            label="Pulling…"
            flavor="Sync inbound"
            noun="Pull"
            busyNoun="Pulling…"
          />
          <TransmitButton
            active={pushing}
            disabled={busy}
            idleClass={ahead > 0 ? btnPrimary : btn}
            onClick={onPush}
            title="Push branch"
            label="Pushing…"
            flavor={ahead > 0 ? `Upload to HQ · ${ahead} ahead` : "Upload to HQ"}
            noun="Push"
            busyNoun="Pushing…"
            onPrimary={ahead > 0}
          />
        </div>
      </form>
    </div>
  );
}

function TransmitButton({
  active,
  disabled,
  idleClass,
  onClick,
  title,
  label,
  flavor,
  noun,
  busyNoun,
  onPrimary,
}: {
  active: boolean;
  disabled: boolean;
  idleClass: string;
  onClick: () => void;
  title: string;
  label: string;
  flavor: string;
  noun: string;
  busyNoun: string;
  onPrimary?: boolean;
}) {
  return (
    <button
      type="button"
      className={active ? btnTransmit : idleClass}
      disabled={disabled || active}
      onClick={onClick}
      title={active ? label : title}
      aria-busy={active}
    >
      {active ? (
        <TvaJumble label={label} noun={busyNoun} />
      ) : (
        <TvaTerm flavor={flavor} noun={noun} onPrimary={onPrimary} />
      )}
    </button>
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
}) {
  const verb = action === "file" ? "File" : "Unfile";
  return (
    <div className="flex min-h-0 flex-1 flex-col border-b border-tva-gold/12 py-3 pr-2.5 pl-3.5 last:border-b-0">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
          {title} <span className="text-tva-muted">{loading ? "…" : items.length}</span>
        </h3>
        <button type="button" className={btn} disabled={loading || items.length === 0} onClick={onAll}>
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
        <TvaVirtualList
          className="min-h-0 flex-1"
          axis="y"
          fill
          count={items.length}
          estimateSize={(index) => (items[index].path === selectedPath ? 56 : 40)}
          getItemKey={(index) => `${action}-${items[index].path}`}
        >
          {(index) => {
            const item = items[index];
            const tone = actionTone(item.status);
            const mark = actionMark(item.status);
            const markTitle = actionMarkTitle(item.status);
            const selected = selectedPath === item.path;
            const test = isTestFile(item.path);
            return (
              <div
                className={cn(
                  "relative grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-0 border-b border-dashed border-tva-gold/12 py-2 pr-2 font-mono text-xs min-h-10 group hover:bg-tva-orange/8",
                  fileRowPad,
                  actionColor[tone],
                  selected && fileRowSelected,
                )}
              >
                <button
                  type="button"
                  title={fileDisplayPath(item)}
                  aria-label={`${markTitle} · ${fileDisplayPath(item)}`}
                  className="absolute inset-0 z-0 border-0 bg-transparent"
                  onClick={() => onOpen(side, item.path)}
                />
                <span className="pointer-events-none relative z-[1] flex min-w-0 items-center gap-1.5 text-inherit group-hover:text-tva-gold-bright">
                  <FileKindIcon path={item.path} color={test ? TEST_FILE_HEX : undefined} />
                  <span className="min-w-0 overflow-hidden">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {fileDisplayName(item)}
                    </span>
                    {selected ? (
                      <span className="mt-0.5 block break-all text-[10px] leading-snug text-tva-muted">
                        {fileDisplayPath(item)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="pointer-events-none relative z-[1] w-4 shrink-0 text-center text-[11px] font-semibold" title={markTitle}>
                  {mark}
                </span>
                <button
                  type="button"
                  className="relative z-[1] shrink-0 border border-tva-gold/35 bg-transparent px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold enabled:hover:border-tva-orange enabled:hover:text-tva-gold-bright disabled:hover:border-tva-gold/35 disabled:hover:text-tva-gold"
                  onClick={(e: ReactMouseEvent) => {
                    e.stopPropagation();
                    void onClick(item.path);
                  }}
                >
                  {verb}
                </button>
              </div>
            );
          }}
        </TvaVirtualList>
      )}
    </div>
  );
}
