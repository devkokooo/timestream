import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  status: StatusPayload | null;
  onStage: (path: string) => void | Promise<void>;
  onUnstage: (path: string) => void | Promise<void>;
  onCommit: (message: string) => Promise<void>;
  busy: boolean;
}

const COMPOSER_MIN = 0.32;
const COMPOSER_MAX = 0.72;
const DESK_MIN = 320;
const DESK_DEFAULT = 420;
const TOP_MIN = 240;

export function AnomalyDock({ status, onStage, onUnstage, onCommit, busy }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [composerRatio, setComposerRatio] = useState(0.46);
  const [deskHeight, setDeskHeight] = useState(DESK_DEFAULT);
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

  function startHeightDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    const workspace = e.currentTarget.closest("[data-workspace]");
    if (!(workspace instanceof HTMLElement)) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = deskHeight;
    const maxH = Math.max(DESK_MIN, workspace.clientHeight - TOP_MIN);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      setDeskHeight(clamp(startH + (startY - ev.clientY), DESK_MIN, maxH));
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startSplit(e: ReactPointerEvent<HTMLButtonElement>) {
    const desk = e.currentTarget.closest("[data-filing-desk]");
    if (!(desk instanceof HTMLElement)) return;
    e.preventDefault();
    const rect = desk.getBoundingClientRect();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const next = (rect.right - ev.clientX) / rect.width;
      setComposerRatio(Math.min(COMPOSER_MAX, Math.max(COMPOSER_MIN, next)));
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <footer
      className={cn(
        "col-span-full min-h-0 border-t border-tva-gold/16 bg-[#1b1713] p-0",
        open
          ? "grid max-h-[calc(100%-240px)] min-h-80 grid-cols-[minmax(0,1fr)] grid-rows-[10px_auto_minmax(0,1fr)]"
          : "flex flex-col",
      )}
      style={open ? { height: deskHeight } : undefined}
    >
      {open ? (
        <button
          type="button"
          className="h-2.5 w-full shrink-0 cursor-row-resize border-0 border-y border-tva-gold/16 bg-[#211c17] p-0 hover:bg-tva-orange/22 focus-visible:bg-tva-orange/22 after:mx-auto after:mt-[3px] after:block after:h-0.5 after:w-9 after:bg-tva-gold/45 after:content-['']"
          aria-label="Adjust filing desk height"
          onPointerDown={startHeightDrag}
        />
      ) : null}
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
        <div
          data-filing-desk
          className="relative min-h-0 min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#1b1713]"
        >
          <div className="absolute inset-0 flex min-h-0 flex-row items-stretch max-[980px]:flex-col">
            <div
              className="flex h-full min-h-0 min-w-0 flex-row items-stretch max-[980px]:h-auto max-[980px]:min-h-0 max-[980px]:flex-1"
              style={{ flex: `${1 - composerRatio} 1 0%` }}
            >
              <Column
                title="UNFILED"
                items={unfiled}
                action="file"
                onClick={onStage}
                onAll={() => runAll(unfiled.map((item) => item.path), onStage)}
                loading={loading}
                empty="No unfiled variance."
              />
              <Column
                title="FILED (STAGED)"
                items={staged}
                action="unfile"
                onClick={onUnstage}
                onAll={() => runAll(staged.map((item) => item.path), onUnstage)}
                loading={loading}
                empty="Nothing staged for filing."
              />
            </div>

            <button
              type="button"
              className="w-2.5 shrink-0 cursor-col-resize self-stretch border-0 border-x border-tva-gold/16 bg-[#211c17] p-0 hover:bg-tva-orange/22 focus-visible:bg-tva-orange/22 max-[980px]:hidden"
              aria-label="Adjust case note width"
              onPointerDown={startSplit}
            />

            <form
              className="grid h-full min-h-0 min-w-[280px] grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(5rem,1fr)_auto] gap-2.5 overflow-hidden bg-[#16120e] px-[18px] pt-4 pb-[18px] max-[980px]:h-auto max-[980px]:min-h-0 max-[980px]:min-w-0 max-[980px]:flex-1"
              style={{ flex: `${composerRatio} 1 280px` }}
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
              <div className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden">
                <span className={cn(fieldLabel, "shrink-0")}>Addendum</span>
                <div className="relative min-h-20 min-w-0 flex-1">
                  <textarea
                    className={cn(fieldInput, "absolute inset-0 h-full min-h-0 w-full resize-none leading-[1.45]")}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Optional case note for this filing"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-[11px] text-tva-muted">
                  {staged.length
                    ? `${staged.length} record${staged.length === 1 ? "" : "s"} ready to file`
                    : "File at least one record before submitting"}
                </p>
                <button className={cn(btn, btnPrimary)} type="submit" disabled={!canFile}>
                  File variant
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </footer>
  );
}

function Column({
  title,
  items,
  action,
  onClick,
  onAll,
  loading,
  empty,
}: {
  title: string;
  items: FileChange[];
  action: "file" | "unfile";
  onClick: (path: string) => void | Promise<void>;
  onAll: () => void;
  loading: boolean;
  empty: string;
}) {
  const verb = action === "file" ? "File" : "Unfile";
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col border-r border-tva-gold/12 py-3 pr-2.5 pl-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
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
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
        {loading ? <AnomalyColumnSkeleton /> : null}
        {!loading && items.length === 0 ? <div className={emptyText}>{empty}</div> : null}
        {!loading
          ? items.map((item) => {
              const kind = fileAction(item.status);
              return (
                <button
                  key={`${action}-${item.path}`}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-0 border-b border-dashed border-tva-gold/12 bg-transparent px-2 py-2 text-left font-mono text-xs text-tva-paper hover:bg-tva-orange/10 hover:text-tva-gold-bright min-h-10 group",
                    actionColor[kind],
                  )}
                  onClick={() => void onClick(item.path)}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {fileDisplayPath(item)}
                  </span>
                  <span className="shrink-0 text-[10px] tracking-[0.12em]">{actionLabel(kind)}</span>
                  <span className="shrink-0 border border-tva-gold/35 px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold group-hover:border-tva-orange group-hover:text-tva-gold-bright">
                    {verb}
                  </span>
                </button>
              );
            })
          : null}
      </TvaScrollArea>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
