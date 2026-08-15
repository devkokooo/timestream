import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { composeCommitMessage } from "../lib/commitMessage";
import { cn } from "../lib/cn";
import { actionLabel, fileAction, fileDisplayPath } from "../lib/diffView";
import {
  actionColor,
  btn,
  btnPrimary,
  emptyText,
  fieldInput,
  fieldLabel,
  panelTitle,
} from "../lib/ui";
import type { FileChange, StatusPayload } from "../lib/types";
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
  onPush?: () => void;
}

export function AnomalyDock({
  status,
  selected,
  onOpenFile,
  onStage,
  onUnstage,
  onCommit,
  busy,
  ahead = 0,
  onPush,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const loading = status == null;
  const staged = status?.staged ?? [];
  const unfiled = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
  const count = staged.length + unfiled.length;
  const message = composeCommitMessage(title, body);
  const canFile = !busy && staged.length > 0 && Boolean(title.trim());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    <footer className="col-span-full flex flex-col border-t border-tva-gold/16 bg-[#1b1713] p-0">
      <button
        type="button"
        className="flex w-full shrink-0 items-center justify-between gap-3 border-0 bg-transparent px-4 py-3 text-left text-inherit hover:bg-tva-orange/8"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <h2 className={cn(panelTitle, "m-0")}>
          TEMPORAL ANOMALIES{" "}
          {loading
            ? "· SCANNING"
            : count
              ? `· ${count} DETECTED`
              : "· SEQUENCE STABLE"}
        </h2>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-tva-gold">
          {open ? "Collapse desk" : "Open filing desk"}
        </span>
      </button>

      {open ? (
        <div className="flex flex-row items-stretch bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#1b1713] max-[980px]:flex-col">
          <div className="flex min-w-0 flex-[1.17] flex-row items-stretch max-[980px]:flex-1">
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
          </div>

          <form
            className="flex min-w-[280px] flex-1 flex-col gap-2.5 bg-[#16120e] px-[18px] pt-4 pb-[18px] max-[980px]:min-w-0"
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
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Addendum</span>
              <textarea
                className={cn(fieldInput, "resize-y leading-[1.45]")}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional case note for this filing"
                rows={3}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-[11px] text-tva-muted">
                {staged.length
                  ? `${staged.length} record${staged.length === 1 ? "" : "s"} ready to file`
                  : "File at least one record before submitting"}
              </p>
              <div className="flex gap-2">
                {ahead > 0 && onPush ? (
                  <button type="button" className={btn} onClick={onPush}>
                    <TvaTerm flavor="File to HQ" noun={`Push branch · ${ahead} ahead`} />
                  </button>
                ) : null}
                <button className={btnPrimary} type="submit" disabled={!canFile}>
                  File variant
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </footer>
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
    <div className="flex min-w-0 flex-1 flex-col border-r border-tva-gold/12 py-3 pr-2.5 pl-3.5">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
          {title} <span className="text-tva-muted">{loading ? "…" : items.length}</span>
        </h3>
        <button
          type="button"
          className={btn}
          disabled={loading || items.length === 0}
          onClick={onAll}
        >
          {verb} all
        </button>
      </div>
      <TvaScrollArea className="max-h-72" axis="y" viewportClassName="max-h-56">
        {loading ? <AnomalyColumnSkeleton /> : null}
        {!loading && items.length === 0 ? <div className={emptyText}>{empty}</div> : null}
        {!loading
          ? items.map((item) => {
              const kind = fileAction(item.status);
              const selected = selectedPath === item.path;
              return (
                <div
                  key={`${action}-${item.path}`}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-0 border-b border-dashed border-tva-gold/12 px-2 py-2 font-mono text-xs text-tva-paper min-h-10 group",
                    actionColor[kind],
                    selected && "bg-tva-orange/14 shadow-[inset_3px_0_0_var(--color-tva-orange)]",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 border-0 bg-transparent p-0 text-left text-inherit hover:text-tva-gold-bright"
                    onClick={() => onOpen(side, item.path)}
                  >
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {fileDisplayPath(item)}
                    </span>
                  </button>
                  <span className="shrink-0 text-[10px] tracking-[0.12em]">{actionLabel(kind)}</span>
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
