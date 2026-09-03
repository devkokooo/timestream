/**
 * Marketing stand-in for `@/diff/PierreDiffSurface` — no @pierre/diffs / Shiki.
 */
import { useMemo } from "react";
import { flattenDiffRows, type DiffViewRow } from "../../../src/diff/diffView";
import { languageFromPath } from "../../../src/diff/syntaxLang";
import type { DiffMode, FileDiff } from "../../../src/diff/types";
import type { ReviewComment } from "../../../src/github/reviews/types";
import { cn } from "../../../src/ui/cn";
import { bakedLineTokens, type BakedToken } from "../lib/tourTokens.generated";

export type DiffSidesLoader = () => Promise<{
  oldFile: { name: string; contents: string } | null;
  newFile: { name: string; contents: string } | null;
}>;

export interface PierreDiffSurfaceProps {
  diff: FileDiff;
  mode: DiffMode;
  reviewable?: boolean;
  readKeys?: ReadonlySet<string>;
  onToggleRead?: (key: string) => void;
  reviewComments?: ReviewComment[];
  loadSides?: DiffSidesLoader;
}

function CodeSpan({ text, tokens }: { text: string; tokens?: BakedToken[] }) {
  if (tokens && tokens.length > 0) {
    return (
      <>
        {tokens.map((token, index) => (
          <span key={index} style={token.color ? { color: token.color } : undefined}>
            {token.content}
          </span>
        ))}
      </>
    );
  }
  return <>{text}</>;
}

function tokensFor(lang: string | null, text: string): BakedToken[] | undefined {
  if (!lang || !text) return text ? [] : undefined;
  return bakedLineTokens(lang, text) ?? [];
}

export function PierreDiffSurface({
  diff,
  mode,
  readKeys,
}: PierreDiffSurfaceProps) {
  const lang = languageFromPath(diff.path);
  const rows = useMemo(
    () => flattenDiffRows(diff.hunks, mode, readKeys ?? new Set()),
    [diff.hunks, mode, readKeys],
  );

  return (
    <div className="pierre-diff-host diff-body min-h-0 flex-1 overflow-auto pb-4">
      {mode === "split" ? (
        <div className="diff-split-frame">
          <div className="diff-side old">
            {rows.map((row, index) => (
              <SiteSplitRow key={`L-${index}`} row={row} side="left" lang={lang} />
            ))}
          </div>
          <div className="diff-side new">
            {rows.map((row, index) => (
              <SiteSplitRow key={`R-${index}`} row={row} side="right" lang={lang} />
            ))}
          </div>
        </div>
      ) : (
        <div className="diff-inline-frame">
          {rows.map((row, index) => (
            <SiteInlineRow key={index} row={row} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

function SiteInlineRow({ row, lang }: { row: DiffViewRow; lang: string | null }) {
  if (row.type === "header") {
    return (
      <div className="mx-2.5 pt-2">
        <div className="diff-hunk-header border border-tva-gold/14 bg-[#241c16] px-2.5 py-[5px] text-[11px] text-tva-gold">
          {row.key}
        </div>
      </div>
    );
  }
  if (row.type !== "inline") return null;
  return (
    <div className={cn("diff-line", row.line.kind)}>
      <div className="diff-gutter-row" aria-hidden>
        <span className="diff-ln">{row.line.oldNo ?? ""}</span>
        <span className="diff-ln">{row.line.newNo ?? ""}</span>
        <span className="diff-mark">
          {row.line.kind === "addition" ? "+" : row.line.kind === "deletion" ? "−" : " "}
        </span>
      </div>
      <div className="diff-code-row">
        <CodeSpan text={row.line.text} tokens={tokensFor(lang, row.line.text)} />
      </div>
    </div>
  );
}

function SiteSplitRow({
  row,
  side,
  lang,
}: {
  row: DiffViewRow;
  side: "left" | "right";
  lang: string | null;
}) {
  if (row.type === "header") {
    return <div className="diff-hunk-slot" style={{ height: 36 }} />;
  }
  if (row.type !== "split") return null;
  const cell = side === "left" ? row.left : row.right;
  return (
    <div className={cn("diff-line", cell?.kind ?? "empty")}>
      <div className="diff-gutter-row" aria-hidden>
        <span className="diff-ln">{cell?.no ?? ""}</span>
      </div>
      <div className="diff-code-row">
        <CodeSpan text={cell?.text ?? ""} tokens={tokensFor(lang, cell?.text ?? "")} />
      </div>
    </div>
  );
}
