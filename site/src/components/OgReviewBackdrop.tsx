import { FileKindIcon } from "../ui/FileKindIcon";
import {
  actionLabel,
  actionMark,
  actionTone,
  fileAction,
  fileDisplayName,
  fileDisplayPath,
  flattenDiffRows,
  hunkLineCounts,
} from "../../../src/diff/diffView";
import { cn } from "../../../src/ui/cn";
import { highlightLines, tokenClassName, type ThemedToken } from "../../../src/diff/syntaxHighlight";
import { languageFromPath } from "../../../src/diff/syntaxLang";
import {
  actionColor,
  btn,
  btnPrimary,
  btnStow,
  eyebrow,
  fieldInput,
  fieldLabel,
  fileRowPad,
  fileRowSelected,
  stampByAction,
  stampChrome,
} from "../../../src/ui/ui";
import { fileDiffFor, INITIAL_STATUS, REVIEW_FILES } from "../lib/tourData";

const SELECTED = REVIEW_FILES[0];
const UNFILED = [...INITIAL_STATUS.unstaged, ...INITIAL_STATUS.untracked];
const DIFF = fileDiffFor(SELECTED.path, SELECTED.status);
const ROWS = flattenDiffRows(DIFF.hunks, "split", new Set());
const HUNK = DIFF.hunks[0];
const COUNTS = HUNK ? hunkLineCounts(HUNK) : { added: 0, deleted: 0 };
const TONE = actionTone(SELECTED.status);

export type OgDiffHighlight = {
  left: ThemedToken[][];
  right: ThemedToken[][];
};

export async function loadOgDiffHighlight(): Promise<OgDiffHighlight> {
  const lang = languageFromPath(SELECTED.path);
  const leftTexts = ROWS.map((row) => (row.type === "split" ? (row.left?.text ?? "") : ""));
  const rightTexts = ROWS.map((row) => (row.type === "split" ? (row.right?.text ?? "") : ""));
  const [left, right] = await Promise.all([
    highlightLines(leftTexts, lang),
    highlightLines(rightTexts, lang),
  ]);
  return { left: left ?? [], right: right ?? [] };
}

function FileRow({
  file,
  selected,
  verb,
}: {
  file: (typeof REVIEW_FILES)[number];
  selected?: boolean;
  verb: string;
}) {
  const tone = actionTone(file.status);
  return (
    <div
      className={cn(
        "relative grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 border-0 border-b border-dashed border-tva-gold/12 py-1.5 pr-2 font-mono text-[11px] leading-tight",
        fileRowPad,
        actionColor[tone],
        selected && fileRowSelected,
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <FileKindIcon path={file.path} />
        <span className="min-w-0 overflow-hidden">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{fileDisplayName(file)}</span>
          <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-snug text-tva-muted">
            {fileDisplayPath(file)}
          </span>
        </span>
      </span>
      <span className="w-4 shrink-0 text-center text-[11px] font-semibold">{actionMark(file.status)}</span>
      <span className="shrink-0 border border-tva-gold/35 bg-transparent px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold">
        {verb}
      </span>
    </div>
  );
}

function SplitLine({
  cell,
  tokens,
}: {
  cell: { no: number | null; text: string; kind: string } | null;
  tokens?: ThemedToken[];
}) {
  return (
    <div className={`diff-line ${cell?.kind ?? "empty"}`}>
      <div className="diff-gutter-row">
        <span className="diff-ln">{cell?.no ?? ""}</span>
      </div>
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
          : (cell?.text ?? "")}
      </div>
    </div>
  );
}

/** Frozen review desk for the 1200×630 share card — no virtual lists, SSR-safe. */
export function OgReviewBackdrop({ highlight }: { highlight: OgDiffHighlight }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_220px] overflow-hidden">
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
        <div className="flex min-h-0 flex-1 flex-col border-b border-tva-gold/12 py-2.5 pr-2.5 pl-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
              UNFILED <span className="text-tva-muted">{UNFILED.length}</span>
            </h3>
            <span className={btnStow}>File all</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {UNFILED.map((file) => (
              <FileRow key={file.path} file={file} verb="File" />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col py-2.5 pr-2.5 pl-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
              FILED (STAGED) <span className="text-tva-muted">1</span>
            </h3>
            <span className={btnStow}>Unfile all</span>
          </div>
          <FileRow file={SELECTED} selected verb="Unfile" />
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e]">
        <header className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-tva-gold/16 bg-linear-to-b from-[#241e18] to-[#1a1612] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className={eyebrow}>Variance record</p>
            <h2 className="mt-1 mb-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[0.02em]">
              {fileDisplayPath(SELECTED)}
            </h2>
          </div>
          <span className={cn(stampChrome, stampByAction[TONE])}>{actionLabel(fileAction(SELECTED.status))}</span>
          <div className="flex border border-tva-gold/28">
            <span className="bg-tva-orange px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tva-ink">
              Split
            </span>
            <span className="border-l border-tva-gold/28 bg-[#2d241c] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-tva-paper-dim">
              Inline
            </span>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {HUNK ? (
            <div className="mx-2.5 mt-2 shrink-0">
              <div className="diff-hunk-header flex w-full min-w-0 items-center gap-2 border border-tva-gold/14 bg-[#241c16] px-2.5 py-[5px]">
                <div className="min-w-0 flex-1 overflow-hidden text-[11px] text-ellipsis whitespace-pre text-tva-gold">
                  {HUNK.header}
                </div>
                <span className="shrink-0 font-mono text-[10px] tracking-[0.04em]">
                  <span className="text-[#c6d18d]">+{COUNTS.added}</span>{" "}
                  <span className="text-[#ff8a6a]">−{COUNTS.deleted}</span>
                </span>
              </div>
            </div>
          ) : null}
          <div className="diff-split-frame min-h-0 flex-1 overflow-hidden">
            <div className="diff-side old overflow-hidden">
              {ROWS.map((row, index) =>
                row.type === "split" ? (
                  <SplitLine key={`L-${index}`} cell={row.left} tokens={highlight.left[index]} />
                ) : null,
              )}
            </div>
            <div className="diff-side new overflow-hidden">
              {ROWS.map((row, index) =>
                row.type === "split" ? (
                  <SplitLine key={`R-${index}`} cell={row.right} tokens={highlight.right[index]} />
                ) : null,
              )}
            </div>
          </div>
        </div>
      </section>

      <form className="flex min-h-0 flex-col gap-2.5 overflow-hidden border-l border-tva-gold/16 bg-[#16120e] px-4 pt-3.5 pb-4">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">CASE NOTE</h3>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Subject</span>
          <span className={cn(fieldInput, "block truncate text-tva-muted")}>Subject of this filing</span>
        </label>
        <label className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className={fieldLabel}>Addendum</span>
          <span className={cn(fieldInput, "min-h-[4.5rem] flex-1 text-tva-muted")}>Optional case note for this filing</span>
        </label>
        <p className="m-0 text-[11px] text-tva-muted">1 record ready to file</p>
        <span className={cn(btnPrimary, "justify-start")}>File variant</span>
        <div className="mt-auto flex flex-col gap-2 border-t border-tva-gold/16 pt-3">
          <span className={cn(btn, "justify-start")}>Fetch</span>
          <span className={cn(btn, "justify-start")}>Pull</span>
          <span className={cn(btnPrimary, "justify-start")}>Upload to HQ · 1 ahead</span>
        </div>
      </form>
    </div>
  );
}
