import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
  actionLabel,
  actionTone,
  DIFF_HEADER_HEIGHT,
  diffContentMinWidth,
  estimateDiffRowSize,
  fileAction,
  fileDisplayPath,
  diffRowText,
  flattenDiffRows,
  hunkHeaderStarts,
  hunkKey,
  hunkLineCounts,
  overlayHunkHeaders,
  type DiffViewRow,
} from "../lib/diffView";
import { tokenClassName, useHighlightedRange, type ThemedToken } from "../lib/syntaxHighlight";
import { languageFromPath } from "../lib/syntaxLang";
import {
  btn,
  emptyText,
  errorText,
  eyebrow,
  stampByAction,
  stampChrome,
} from "../lib/ui";
import type { DiffHunk, DiffLine, DiffMode, FileChange, FileDiff, ReviewComment } from "../lib/types";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

interface Props {
  file: FileChange | null;
  diff: FileDiff | null;
  mode: DiffMode;
  error: string | null;
  onMode: (mode: DiffMode) => void;
  onClose: () => void;
  onFile?: () => void | Promise<void>;
  reviewComments?: ReviewComment[];
  onAddComment?: (line: number, body: string) => void;
}

export function DiffViewer({
  file,
  diff,
  mode,
  error,
  onMode,
  onClose,
  onFile,
  reviewComments,
  onAddComment,
}: Props) {
  const status = file?.status ?? diff?.status ?? "modified";
  const action = fileAction(status);
  const tone = actionTone(status);
  const title = file
    ? fileDisplayPath(file)
    : diff
      ? fileDisplayPath(diff)
      : "";
  const lang = languageFromPath(file?.path ?? diff?.path ?? "");
  const reviewable = Boolean(onFile);
  const fileKey = file?.path ?? diff?.path ?? "";
  const hunkKeys = useMemo(
    () => (diff && !diff.binary ? diff.hunks.map((hunk) => hunkKey(hunk)) : []),
    [diff],
  );
  const readByFile = useRef(new Map<string, Set<string>>());
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set());
  const [filing, setFiling] = useState(false);
  const [range, setRange] = useState({ start: 0, end: 40 });

  useEffect(() => {
    setReadKeys(new Set(readByFile.current.get(fileKey) ?? []));
  }, [fileKey]);

  const toggleRead = useCallback(
    (key: string) => {
      setReadKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        if (fileKey) readByFile.current.set(fileKey, next);
        return next;
      });
    },
    [fileKey],
  );

  const onRangeChange = useCallback((startIndex: number, endIndex: number) => {
    setRange((prev) =>
      prev.start === startIndex && prev.end === endIndex ? prev : { start: startIndex, end: endIndex },
    );
  }, []);

  const rows = useMemo(
    () => (diff && !diff.binary ? flattenDiffRows(diff.hunks, mode, readKeys) : []),
    [diff, mode, readKeys],
  );
  const leftAt = useCallback((index: number) => diffRowText(rows[index], "left"), [rows]);
  const rightAt = useCallback((index: number) => diffRowText(rows[index], "right"), [rows]);
  const leftTokens = useHighlightedRange(leftAt, rows.length, lang, range.start, range.end, rows);
  const rightTokens = useHighlightedRange(rightAt, rows.length, lang, range.start, range.end, rows);
  const minWidth = useMemo(
    () => (diff && !diff.binary ? diffContentMinWidth(diff.hunks, mode) : undefined),
    [diff, mode],
  );

  const readCount = reviewable ? hunkKeys.filter((key) => readKeys.has(key)).length : 0;
  const hunkTotal = hunkKeys.length;
  const empty = Boolean(error) || Boolean(diff?.binary) || Boolean(diff && !diff.binary && diff.hunks.length === 0);

  async function fileRecord() {
    if (!onFile || filing) return;
    setFiling(true);
    try {
      await onFile();
    } finally {
      setFiling(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e]">
      <header className="flex items-center gap-3 border-b border-tva-gold/16 bg-linear-to-b from-[#241e18] to-[#1a1612] px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className={eyebrow}>Variance record</p>
          <h2 className="mt-1 mb-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[0.02em]">
            {title}
          </h2>
        </div>
        <span className={cn(stampChrome, stampByAction[tone])}>{actionLabel(action)}</span>
        {reviewable && hunkTotal > 0 ? (
          <p
            className="m-0 shrink-0 text-[11px] uppercase tracking-[0.12em] text-tva-gold"
            aria-label={`${readCount} of ${hunkTotal} hunks read`}
          >
            {readCount}/{hunkTotal}
          </p>
        ) : null}
        {onFile ? (
          <button type="button" className={btn} disabled={filing} onClick={() => void fileRecord()}>
            File
          </button>
        ) : null}
        <div className="flex border border-tva-gold/28" role="group" aria-label="Diff layout">
          <button
            type="button"
            className={cn(
              "border-0 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em]",
              mode === "split"
                ? "bg-tva-orange font-semibold text-tva-ink"
                : "bg-[#2d241c] text-tva-paper-dim",
            )}
            aria-pressed={mode === "split"}
            onClick={() => onMode("split")}
          >
            Side by side
          </button>
          <button
            type="button"
            className={cn(
              "border-0 border-l border-tva-gold/28 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em]",
              mode === "inline"
                ? "bg-tva-orange font-semibold text-tva-ink"
                : "bg-[#2d241c] text-tva-paper-dim",
            )}
            aria-pressed={mode === "inline"}
            onClick={() => onMode("inline")}
          >
            Inline
          </button>
        </div>
        <button type="button" className={btn} onClick={onClose}>
          Return to timeline
        </button>
      </header>

      {empty ? (
        <TvaScrollArea className="diff-body min-h-0 flex-1" axis="both" fill>
          {error ? <p className={cn(errorText, "px-3")}>{error}</p> : null}
          {diff?.binary ? (
            <p className={cn(emptyText, "px-3")}>Binary record — no textual variance.</p>
          ) : null}
          {diff && !diff.binary && diff.hunks.length === 0 ? (
            <p className={cn(emptyText, "px-3")}>No textual variance recorded.</p>
          ) : null}
        </TvaScrollArea>
      ) : mode === "split" ? (
        <SplitDiff
          rows={rows}
          hunks={diff?.hunks ?? []}
          reviewable={reviewable}
          readKeys={readKeys}
          onToggleRead={toggleRead}
          leftTokens={leftTokens}
          rightTokens={rightTokens}
          minWidth={minWidth}
          onRangeChange={onRangeChange}
        />
      ) : (
        <TvaVirtualList
          className="diff-body min-h-0 flex-1"
          axis="both"
          fill
          count={rows.length}
          estimateSize={(index) => estimateDiffRowSize(rows[index])}
          getItemKey={(index) => diffRowKey(rows[index])}
          minWidth={minWidth}
          measure={false}
          onRangeChange={onRangeChange}
          overlay={(virtual) => stickyHunkHeader(virtual.startIndex, rows, diff?.hunks, reviewable, readKeys, toggleRead)}
        >
          {(index) => {
            const row = rows[index];
            if (!row || row.type !== "inline") {
              if (row?.type === "header") {
                const hunk = diff?.hunks[row.hunkIndex];
                if (!hunk) return null;
                return (
                  <div className="mx-2.5 pt-2">
                    <HunkHeader
                      hunk={hunk}
                      reviewable={reviewable}
                      read={reviewable && readKeys.has(row.key)}
                      onToggleRead={() => toggleRead(row.key)}
                    />
                  </div>
                );
              }
              return null;
            }
            return (
              <div className={`diff-line ${row.line.kind}`}>
                <GutterRow line={row.line} />
                <CodeRow text={row.line.text} tokens={leftTokens[index]} />
              </div>
            );
          }}
        </TvaVirtualList>
      )}
      {reviewComments && reviewComments.length > 0 ? (
        <aside className="max-h-40 overflow-auto border-t border-tva-gold/16 px-3 py-2">
          <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.14em] text-tva-gold">
            Margin notes · Pull request review comments
          </p>
          {reviewComments
            .filter((c) => !file || c.path === file.path || c.path === diff?.path)
            .map((c) => (
              <p key={c.id} className="m-0 mb-1 text-[11px] text-tva-paper-dim" title="Pull request review comment">
                L{c.line ?? "?"} {c.userLogin}: {c.body}
              </p>
            ))}
          {onAddComment ? (
            <p className="m-0 text-[10px] text-tva-muted">
              Submit a review from the Requests docket. Comments here are GitHub review notes.
            </p>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

function stickyHunkHeader(
  startIndex: number,
  rows: DiffViewRow[],
  hunks: DiffHunk[] | undefined,
  reviewable: boolean,
  readKeys: Set<string>,
  onToggleRead: (key: string) => void,
) {
  const row = rows[startIndex];
  if (!row || row.type === "header" || !hunks) return null;
  const hunk = hunks[row.hunkIndex];
  const key = hunkKey(hunk);
  return (
    <div className="pointer-events-auto mx-2.5">
      <HunkHeader
        hunk={hunk}
        reviewable={reviewable}
        read={reviewable && readKeys.has(key)}
        onToggleRead={() => onToggleRead(key)}
        sticky
      />
    </div>
  );
}

function SplitDiff({
  rows,
  hunks,
  reviewable,
  readKeys,
  onToggleRead,
  leftTokens,
  rightTokens,
  minWidth,
  onRangeChange,
}: {
  rows: DiffViewRow[];
  hunks: DiffHunk[];
  reviewable: boolean;
  readKeys: Set<string>;
  onToggleRead: (key: string) => void;
  leftTokens: Array<ThemedToken[] | undefined>;
  rightTokens: Array<ThemedToken[] | undefined>;
  minWidth?: number;
  onRangeChange: (startIndex: number, endIndex: number) => void;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const readScroll = useCallback(() => {
    const el = leftRef.current ?? rightRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setViewportH(el.clientHeight);
  }, []);

  const syncY = useCallback(
    (source: "left" | "right") => {
      if (syncing.current) return;
      const from = source === "left" ? leftRef.current : rightRef.current;
      const to = source === "left" ? rightRef.current : leftRef.current;
      if (!from || !to) return;
      if (from.scrollTop !== to.scrollTop) {
        syncing.current = true;
        to.scrollTop = from.scrollTop;
        syncing.current = false;
      }
      readScroll();
    },
    [readScroll],
  );

  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    readScroll();
    const ro = new ResizeObserver(readScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [readScroll, rows.length]);

  const handleRange = useCallback(
    (start: number, end: number) => {
      onRangeChange(start, end);
    },
    [onRangeChange],
  );

  const headerStarts = useMemo(() => hunkHeaderStarts(rows), [rows]);
  const headers = useMemo(
    () => overlayHunkHeaders(headerStarts, scrollTop, viewportH),
    [headerStarts, scrollTop, viewportH],
  );

  function onHeaderWheel(e: React.WheelEvent) {
    const el = leftRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollTop += e.deltaY;
    syncY("left");
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="diff-split-frame min-h-0 flex-1">
        <div className="diff-side old">
          <TvaVirtualList
            className="diff-body min-h-0 flex-1"
            axis="both"
            rails="x"
            fill
            count={rows.length}
            estimateSize={(index) => estimateDiffRowSize(rows[index])}
            getItemKey={(index) => `L-${diffRowKey(rows[index])}`}
            minWidth={minWidth}
            measure={false}
            viewportRef={leftRef}
            onScroll={() => syncY("left")}
            onRangeChange={handleRange}
          >
            {(index) => splitPaneRow(rows[index], "left", leftTokens[index])}
          </TvaVirtualList>
        </div>
        <div className="diff-side new">
          <TvaVirtualList
            className="diff-body min-h-0 flex-1"
            axis="both"
            rails="both"
            fill
            count={rows.length}
            estimateSize={(index) => estimateDiffRowSize(rows[index])}
            getItemKey={(index) => `R-${diffRowKey(rows[index])}`}
            minWidth={minWidth}
            measure={false}
            viewportRef={rightRef}
            onScroll={() => syncY("right")}
          >
            {(index) => splitPaneRow(rows[index], "right", rightTokens[index])}
          </TvaVirtualList>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
        {headers.map((item) => {
          const hunk = hunks[item.hunkIndex];
          if (!hunk) return null;
          return (
            <div
              key={item.key}
              className="pointer-events-auto absolute right-3 left-2.5"
              style={{ top: item.top }}
              onWheel={onHeaderWheel}
            >
              <HunkHeader
                hunk={hunk}
                reviewable={reviewable}
                read={reviewable && readKeys.has(item.key)}
                onToggleRead={() => onToggleRead(item.key)}
                sticky={item.sticky}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function splitPaneRow(
  row: DiffViewRow | undefined,
  side: "left" | "right",
  tokens: ThemedToken[] | undefined,
) {
  if (!row) return null;
  if (row.type === "header") {
    return <div className="diff-hunk-slot" style={{ height: DIFF_HEADER_HEIGHT }} />;
  }
  if (row.type !== "split") return null;
  const cell = side === "left" ? row.left : row.right;
  return <SplitCellView cell={cell} tokens={tokens} />;
}

function diffRowKey(row: DiffViewRow): string {
  if (row.type === "header") return `h-${row.key}`;
  if (row.type === "inline") return `i-${row.hunkIndex}-${row.lineIndex}`;
  return `s-${row.hunkIndex}-${row.rowIndex}`;
}

function HunkHeader({
  hunk,
  reviewable,
  read,
  onToggleRead,
  sticky = false,
}: {
  hunk: DiffHunk;
  reviewable: boolean;
  read: boolean;
  onToggleRead: () => void;
  sticky?: boolean;
}) {
  const counts = hunkLineCounts(hunk);
  return (
    <div
      className={cn(
        "diff-hunk-header flex w-full min-w-0 items-center gap-2 border border-tva-gold/14 bg-[#241c16] px-2.5 py-[5px]",
        read && "border-tva-gold/8 bg-[#1a1612]",
        sticky && "diff-sticky-header",
      )}
    >
      {reviewable ? (
        <button
          type="button"
          className="min-w-0 flex-1 overflow-hidden border-0 bg-transparent p-0 text-left text-[11px] text-ellipsis whitespace-pre text-tva-gold hover:text-tva-gold-bright"
          aria-expanded={!read}
          aria-label={read ? "Expand hunk" : "Collapse hunk as read"}
          onClick={onToggleRead}
        >
          {hunk.header}
        </button>
      ) : (
        <div className="min-w-0 flex-1 overflow-hidden text-[11px] text-ellipsis whitespace-pre text-tva-gold">
          {hunk.header}
        </div>
      )}
      {counts.added > 0 || counts.deleted > 0 ? (
        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tracking-[0.04em]" aria-hidden>
          {counts.added > 0 ? <span className="text-[#c6d18d]">+{counts.added}</span> : null}
          {counts.added > 0 && counts.deleted > 0 ? " " : null}
          {counts.deleted > 0 ? <span className="text-[#ff8a6a]">−{counts.deleted}</span> : null}
        </span>
      ) : null}
      {reviewable ? (
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-tva-gold">
          <input
            type="checkbox"
            checked={read}
            onChange={onToggleRead}
            aria-label={read ? "Mark hunk unread" : "Mark hunk as read"}
          />
          Read
        </label>
      ) : null}
    </div>
  );
}

function GutterRow({ line }: { line: DiffLine }) {
  const mark = line.kind === "addition" ? "+" : line.kind === "deletion" ? "−" : " ";
  return (
    <div className="diff-gutter-row" aria-hidden>
      <span className="diff-ln">{line.oldNo ?? ""}</span>
      <span className="diff-ln">{line.newNo ?? ""}</span>
      <span className="diff-mark">{mark}</span>
    </div>
  );
}

function SplitCellView({
  cell,
  tokens,
}: {
  cell: { no: number | null; text: string; kind: string } | null;
  tokens: ThemedToken[] | undefined;
}) {
  return (
    <div className={`diff-line ${cell?.kind ?? "empty"}`}>
      <div className="diff-gutter-row" aria-hidden>
        <span className="diff-ln">{cell?.no ?? ""}</span>
      </div>
      <CodeRow text={cell?.text ?? ""} tokens={tokens} />
    </div>
  );
}

function CodeRow({ text, tokens }: { text: string; tokens?: ThemedToken[] }) {
  return (
    <div className="diff-code-row">
      {tokens && tokens.length > 0
        ? tokens.map((token, index) => (
            <span
              key={index}
              className={tokenClassName(token.fontStyle)}
              style={token.color ? { color: token.color } : undefined}
            >
              {token.content}
            </span>
          ))
        : text}
    </div>
  );
}
