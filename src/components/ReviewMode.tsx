import {
  useCallback,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { composeCommitMessage } from "../lib/commitMessage";
import { cn } from "../lib/cn";
import { actionMark, actionMarkTitle, actionTone, fileDisplayName, fileDisplayPath } from "../lib/diffView";
import { isTestFile } from "../lib/fileKind";
import {
  actionColor,
  btn,
  btnPrimary,
  emptyText,
  eyebrow,
  fieldInput,
  fieldLabel,
  TEST_FILE_HEX,
} from "../lib/ui";
import type { FileChange, StatusPayload } from "../lib/types";
import { FileKindIcon } from "./FileKindIcon";
import { AnomalyColumnSkeleton } from "./TvaSkeleton";
import { TvaTerm } from "./TvaTerm";
import { TvaScrollArea } from "./TvaScrollArea";

export type AnomalySide = "staged" | "unstaged";

interface Props {
  status: StatusPayload | null;
  selected: { side: AnomalySide; path: string } | null;
  onOpenFile: (side: AnomalySide, path: string) => void;
  onStage: (path: string) => void | Promise<void>;
  onUnstage: (path: string) => void | Promise<void>;
  onCommit: (message: string) => Promise<void>;
  busy: boolean;
  ahead?: number;
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
  ahead = 0,
  onPush,
  onFetch,
  onPull,
  children,
}: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const loading = status == null;
  const staged = status?.staged ?? [];
  const unfiled = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
  const message = composeCommitMessage(title, body);
  const canFile = !busy && staged.length > 0 && Boolean(title.trim());

  const runAll = useCallback(async (paths: string[], act: (path: string) => void | Promise<void>) => {
    for (const path of paths) {
      await act(path);
    }
  }, []);

  async function submit() {
    if (!canFile) return;
    await onCommit(message);
    setTitle("");
    setBody("");
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
            className={cn(fieldInput, "text-[15px]")}
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
        <p className="m-0 text-[11px] text-tva-muted">
          {staged.length
            ? `${staged.length} record${staged.length === 1 ? "" : "s"} ready to file`
            : "File at least one record before submitting"}
        </p>
        <button className={btnPrimary} type="submit" disabled={!canFile}>
          File variant
        </button>
        <div className="mt-auto flex flex-col gap-2 border-t border-tva-gold/16 pt-3">
          <button type="button" className={btn} disabled={busy} onClick={onFetch} title="Fetch from origin">
            <TvaTerm flavor="Dispatch" noun="Fetch" />
          </button>
          <button type="button" className={btn} disabled={busy} onClick={onPull} title="Fast-forward pull">
            <TvaTerm flavor="Sync inbound" noun="Pull" />
          </button>
          <button
            type="button"
            className={ahead > 0 ? btnPrimary : btn}
            disabled={busy}
            onClick={onPush}
            title="Push branch"
          >
            <TvaTerm
              flavor={ahead > 0 ? `File to HQ · ${ahead} ahead` : "File to HQ"}
              noun="Push"
              onPrimary={ahead > 0}
            />
          </button>
        </div>
      </form>
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
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
        {loading ? <AnomalyColumnSkeleton /> : null}
        {!loading && items.length === 0 ? <div className={emptyText}>{empty}</div> : null}
        {!loading
          ? items.map((item) => {
              const tone = actionTone(item.status);
              const mark = actionMark(item.status);
              const markTitle = actionMarkTitle(item.status);
              const selected = selectedPath === item.path;
              const test = isTestFile(item.path);
              return (
                <div
                  key={`${action}-${item.path}`}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-0 border-b border-dashed border-tva-gold/12 px-2 py-2 font-mono text-xs min-h-10 group",
                    actionColor[tone],
                    selected && "bg-tva-orange/14 shadow-[inset_3px_0_0_var(--color-tva-orange)]",
                  )}
                >
                  <button
                    type="button"
                    title={fileDisplayPath(item)}
                    aria-label={`${markTitle} · ${fileDisplayPath(item)}`}
                    className="flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-inherit hover:text-tva-gold-bright"
                    onClick={() => onOpen(side, item.path)}
                  >
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
                  </button>
                  <span className="w-4 shrink-0 text-center text-[11px] font-semibold" title={markTitle}>
                    {mark}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 border border-tva-gold/35 bg-transparent px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold hover:border-tva-orange hover:text-tva-gold-bright"
                    onClick={(e: ReactMouseEvent) => {
                      e.stopPropagation();
                      void onClick(item.path);
                    }}
                  >
                    {verb}
                  </button>
                </div>
              );
            })
          : null}
      </TvaScrollArea>
    </div>
  );
}
