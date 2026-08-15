import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
  actionLabel,
  actionTone,
  fileAction,
  fileDisplayPath,
  hunkKey,
  hunkLineCounts,
  pairHunkLines,
} from "../lib/diffView";
import type { SplitCell as SplitCellModel } from "../lib/diffView";
import { tokenClassName, useHighlightedLines, type ThemedToken } from "../lib/syntaxHighlight";
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

  const readCount = reviewable ? hunkKeys.filter((key) => readKeys.has(key)).length : 0;
  const hunkTotal = hunkKeys.length;

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

      <TvaScrollArea className="diff-body min-h-0 flex-1" axis="both" fill>
        {error ? <p className={cn(errorText, "px-3")}>{error}</p> : null}
        {diff?.binary ? (
          <p className={cn(emptyText, "px-3")}>Binary record — no textual variance.</p>
        ) : null}
        {diff && !diff.binary && diff.hunks.length === 0 ? (
          <p className={cn(emptyText, "px-3")}>No textual variance recorded.</p>
        ) : null}
        {diff && !diff.binary
          ? diff.hunks.map((hunk, index) => {
              const key = hunkKey(hunk);
              return (
                <HunkBlock
                  key={`${key}-${index}`}
                  hunk={hunk}
                  lang={lang}
                  mode={mode}
                  reviewable={reviewable}
                  read={reviewable && readKeys.has(key)}
                  onToggleRead={() => toggleRead(key)}
                />
              );
            })
          : null}
      </TvaScrollArea>
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

function HunkBlock({
  hunk,
  lang,
  mode,
  reviewable,
  read,
  onToggleRead,
}: {
  hunk: DiffHunk;
  lang: string | null;
  mode: DiffMode;
  reviewable: boolean;
  read: boolean;
  onToggleRead: () => void;
}) {
  const counts = useMemo(() => hunkLineCounts(hunk), [hunk]);

  return (
    <div
      className={cn(
        "diff-hunk mx-2.5 my-2 mb-3.5 border border-tva-gold/14 bg-[#120e0b]",
        read && "border-tva-gold/8",
      )}
    >
      <div
        className={cn(
          "diff-hunk-header flex items-center gap-2 border-b border-tva-gold/12 bg-[#241c16] px-2.5 py-[5px]",
          read && "border-b-0 bg-[#1a1612]",
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
          <span className="shrink-0 font-mono text-[10px] tracking-[0.04em]" aria-hidden>
            {counts.added > 0 ? <span className="text-[#c6d18d]">+{counts.added}</span> : null}
            {counts.added > 0 && counts.deleted > 0 ? " " : null}
            {counts.deleted > 0 ? <span className="text-[#ff8a6a]">−{counts.deleted}</span> : null}
          </span>
        ) : null}
        {reviewable ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-tva-gold">
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
      {read ? null : mode === "split" ? (
        <SplitHunk hunk={hunk} lang={lang} />
      ) : (
        <InlineHunk hunk={hunk} lang={lang} />
      )}
    </div>
  );
}

function InlineHunk({ hunk, lang }: { hunk: DiffHunk; lang: string | null }) {
  const texts = useMemo(() => hunk.lines.map((line) => line.text), [hunk]);
  const highlighted = useHighlightedLines(texts, lang);

  return (
    <TvaScrollArea className="diff-code-scroll" axis="x">
      <div className="diff-inline-frame">
        {hunk.lines.map((line, index) => (
          <div
            key={`${line.kind}-${line.oldNo}-${line.newNo}-${index}`}
            className={`diff-line ${line.kind}`}
          >
            <GutterRow line={line} />
            <CodeRow text={line.text} tokens={highlighted?.[index]} />
          </div>
        ))}
      </div>
    </TvaScrollArea>
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

function SplitHunk({ hunk, lang }: { hunk: DiffHunk; lang: string | null }) {
  const rows = useMemo(() => pairHunkLines(hunk.lines), [hunk]);
  const leftTexts = useMemo(() => rows.map((row) => row.left?.text ?? ""), [rows]);
  const rightTexts = useMemo(() => rows.map((row) => row.right?.text ?? ""), [rows]);
  const leftTokens = useHighlightedLines(leftTexts, lang);
  const rightTokens = useHighlightedLines(rightTexts, lang);

  return (
    <div className="diff-split-frame">
      <SplitSide side="old" cells={rows.map((row) => row.left)} tokens={leftTokens} />
      <SplitSide side="new" cells={rows.map((row) => row.right)} tokens={rightTokens} />
    </div>
  );
}

function SplitSide({
  side,
  cells,
  tokens,
}: {
  side: "old" | "new";
  cells: Array<SplitCellModel | null>;
  tokens: ThemedToken[][] | null;
}) {
  return (
    <div className={`diff-side ${side}`}>
      <TvaScrollArea className="diff-code-scroll" axis="x">
        <div className="diff-side-frame">
          {cells.map((cell, index) => (
            <div
              key={`${side}-${index}`}
              className={`diff-line ${cell?.kind ?? "empty"}`}
            >
              <div className="diff-gutter-row" aria-hidden>
                <span className="diff-ln">{cell?.no ?? ""}</span>
              </div>
              <CodeRow text={cell?.text ?? ""} tokens={tokens?.[index]} />
            </div>
          ))}
        </div>
      </TvaScrollArea>
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
