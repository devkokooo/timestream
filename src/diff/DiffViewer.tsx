import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/ui/cn";
import {
  actionLabel,
  actionTone,
  fileAction,
  fileDisplayPath,
  hunkKey,
} from "@/diff/diffView";
import { PierreDiffSurface, type DiffSidesLoader } from "@/diff/PierreDiffSurface";
import {
  btn,
  btnStow,
  emptyText,
  errorText,
  eyebrow,
  stampByAction,
  stampChrome,
} from "@/ui/ui";
import type { DiffMode, FileDiff } from "@/diff/types";
import type { FileChange } from "@/git/types";
import type { ReviewComment } from "@/github/reviews/types";
import { PersonName } from "@/auth/PersonName";
import { TvaScrollArea } from "@/ui/TvaScrollArea";

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
  /** Lazy old/new file contents for Pierre expand-above/below. */
  loadSides?: DiffSidesLoader;
  /** Denser chrome for narrow embeds (marketing tour). */
  compact?: boolean;
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
  loadSides,
  compact = false,
}: Props) {
  const status = file?.status ?? diff?.status ?? "modified";
  const action = fileAction(status);
  const tone = actionTone(status);
  const title = file
    ? fileDisplayPath(file)
    : diff
      ? fileDisplayPath(diff)
      : "";
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
  const empty =
    Boolean(error) ||
    Boolean(diff?.binary) ||
    Boolean(diff && !diff.binary && diff.hunks.length === 0);

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
      <header
        className={cn(
          "flex min-w-0 flex-wrap items-center border-b border-tva-gold/16 bg-linear-to-b from-[#241e18] to-[#1a1612]",
          compact ? "gap-x-2.5 gap-y-2 px-3 py-2" : "gap-3 px-3.5 py-2.5",
        )}
      >
        <div className="min-w-0 flex-1 basis-44">
          <p className={eyebrow}>Variance record</p>
          <h2 className="mt-1 mb-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[0.02em]">
            {title}
          </h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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
            <button
              type="button"
              className={compact ? btnStow : btn}
              disabled={filing}
              onClick={() => void fileRecord()}
            >
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
              {compact ? "Split" : "Side by side"}
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
          <button type="button" className={compact ? btnStow : btn} onClick={onClose}>
            {compact ? "Close" : "Return to timeline"}
          </button>
        </div>
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
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {diff && !diff.binary ? (
            <PierreDiffSurface
              diff={diff}
              mode={mode}
              reviewable={reviewable}
              readKeys={reviewable ? readKeys : undefined}
              onToggleRead={reviewable ? toggleRead : undefined}
              reviewComments={reviewComments}
              loadSides={loadSides}
            />
          ) : null}
        </div>
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
                L{c.line ?? "?"} <PersonName name={c.userLogin} login={c.userLogin} />: {c.body}
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
