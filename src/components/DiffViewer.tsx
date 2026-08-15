import { actionLabel, fileAction, fileDisplayPath, pairHunkLines } from "../lib/diffView";
import type { SplitCell as SplitCellModel } from "../lib/diffView";
import type { DiffHunk, DiffLine, DiffMode, FileChange, FileDiff } from "../lib/types";
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  file: FileChange | null;
  diff: FileDiff | null;
  mode: DiffMode;
  error: string | null;
  onMode: (mode: DiffMode) => void;
  onClose: () => void;
}

export function DiffViewer({ file, diff, mode, error, onMode, onClose }: Props) {
  const status = file?.status ?? diff?.status ?? "modified";
  const action = fileAction(status);
  const title = file
    ? fileDisplayPath(file)
    : diff
      ? fileDisplayPath(diff)
      : "";

  return (
    <section className="diff-viewer">
      <header className="diff-head">
        <div className="diff-title">
          <p className="eyebrow">Variance record</p>
          <h2>{title}</h2>
        </div>
        <span className={`stamp ${action}`}>{actionLabel(action)}</span>
        <div className="diff-mode" role="group" aria-label="Diff layout">
          <button
            type="button"
            className={mode === "split" ? "active" : ""}
            aria-pressed={mode === "split"}
            onClick={() => onMode("split")}
          >
            Side by side
          </button>
          <button
            type="button"
            className={mode === "inline" ? "active" : ""}
            aria-pressed={mode === "inline"}
            onClick={() => onMode("inline")}
          >
            Inline
          </button>
        </div>
        <button type="button" className="btn" onClick={onClose}>
          Return to timeline
        </button>
      </header>

      <TvaScrollArea className="diff-body" axis="both" fill>
        {error ? <p className="error">{error}</p> : null}
        {diff?.binary ? (
          <p className="empty">Binary record — no textual variance.</p>
        ) : null}
        {diff && !diff.binary && diff.hunks.length === 0 ? (
          <p className="empty">No textual variance recorded.</p>
        ) : null}
        {diff && !diff.binary
          ? diff.hunks.map((hunk, index) =>
              mode === "split" ? (
                <SplitHunk key={`${hunk.header}-${index}`} hunk={hunk} />
              ) : (
                <InlineHunk key={`${hunk.header}-${index}`} hunk={hunk} />
              ),
            )
          : null}
      </TvaScrollArea>
    </section>
  );
}

function InlineHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="diff-hunk">
      <div className="diff-hunk-head">{hunk.header}</div>
      <div className="diff-inline-frame">
        <div className="diff-gutters" aria-hidden>
          {hunk.lines.map((line, index) => (
            <GutterRow
              key={`${line.kind}-${line.oldNo}-${line.newNo}-${index}`}
              line={line}
            />
          ))}
        </div>
        <TvaScrollArea className="diff-code-scroll" axis="x">
          <div className="diff-code-block">
            {hunk.lines.map((line, index) => (
              <div
                key={`${line.kind}-${line.oldNo}-${line.newNo}-${index}`}
                className={`diff-code-row ${line.kind}`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </TvaScrollArea>
      </div>
    </div>
  );
}

function GutterRow({ line }: { line: DiffLine }) {
  const mark = line.kind === "addition" ? "+" : line.kind === "deletion" ? "−" : " ";
  return (
    <div className={`diff-gutter-row ${line.kind}`}>
      <span className="diff-ln">{line.oldNo ?? ""}</span>
      <span className="diff-ln">{line.newNo ?? ""}</span>
      <span className="diff-mark">{mark}</span>
    </div>
  );
}

function SplitHunk({ hunk }: { hunk: DiffHunk }) {
  const rows = pairHunkLines(hunk.lines);
  return (
    <div className="diff-hunk">
      <div className="diff-hunk-head">{hunk.header}</div>
      <div className="diff-split-frame">
        <SplitSide side="old" cells={rows.map((row) => row.left)} />
        <SplitSide side="new" cells={rows.map((row) => row.right)} />
      </div>
    </div>
  );
}

function SplitSide({
  side,
  cells,
}: {
  side: "old" | "new";
  cells: Array<SplitCellModel | null>;
}) {
  return (
    <div className={`diff-side ${side}`}>
      <div className="diff-side-frame">
        <div className="diff-gutters" aria-hidden>
          {cells.map((cell, index) => (
            <div
              key={`${side}-g-${index}`}
              className={`diff-gutter-row ${cell?.kind ?? "empty"}`}
            >
              <span className="diff-ln">{cell?.no ?? ""}</span>
            </div>
          ))}
        </div>
        <TvaScrollArea className="diff-code-scroll" axis="x">
          <div className="diff-code-block">
            {cells.map((cell, index) => (
              <div
                key={`${side}-c-${index}`}
                className={`diff-code-row ${cell?.kind ?? "empty"}`}
              >
                {cell?.text ?? ""}
              </div>
            ))}
          </div>
        </TvaScrollArea>
      </div>
    </div>
  );
}
