import { useMemo } from "react";
import { actionLabel, fileAction, fileDisplayPath, pairHunkLines } from "../lib/diffView";
import type { SplitCell as SplitCellModel } from "../lib/diffView";
import { tokenClassName, useHighlightedLines, type ThemedToken } from "../lib/syntaxHighlight";
import { languageFromPath } from "../lib/syntaxLang";
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
  const lang = languageFromPath(file?.path ?? diff?.path ?? "");

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
                <SplitHunk key={`${hunk.header}-${index}`} hunk={hunk} lang={lang} />
              ) : (
                <InlineHunk key={`${hunk.header}-${index}`} hunk={hunk} lang={lang} />
              ),
            )
          : null}
      </TvaScrollArea>
    </section>
  );
}

function InlineHunk({ hunk, lang }: { hunk: DiffHunk; lang: string | null }) {
  const texts = useMemo(() => hunk.lines.map((line) => line.text), [hunk]);
  const highlighted = useHighlightedLines(texts, lang);

  return (
    <div className="diff-hunk">
      <div className="diff-hunk-head">{hunk.header}</div>
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

function SplitHunk({ hunk, lang }: { hunk: DiffHunk; lang: string | null }) {
  const rows = useMemo(() => pairHunkLines(hunk.lines), [hunk]);
  const leftTexts = useMemo(() => rows.map((row) => row.left?.text ?? ""), [rows]);
  const rightTexts = useMemo(() => rows.map((row) => row.right?.text ?? ""), [rows]);
  const leftTokens = useHighlightedLines(leftTexts, lang);
  const rightTokens = useHighlightedLines(rightTexts, lang);

  return (
    <div className="diff-hunk">
      <div className="diff-hunk-head">{hunk.header}</div>
      <div className="diff-split-frame">
        <SplitSide side="old" cells={rows.map((row) => row.left)} tokens={leftTokens} />
        <SplitSide side="new" cells={rows.map((row) => row.right)} tokens={rightTokens} />
      </div>
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
