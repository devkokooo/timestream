import { useMemo } from "react";
import { bakedLineTokens, type BakedToken, TOUR_TOKENS } from "../lib/tourTokens.generated";

/** Marketing stand-in for `@/diff/syntaxHighlight` — static tokens, no Shiki runtime. */
export type ThemedToken = BakedToken;

export function isHighlightableLanguage(lang: string | null): lang is string {
  return lang != null && lang in TOUR_TOKENS;
}

export async function highlightLines(
  texts: string[],
  lang: string | null,
): Promise<ThemedToken[][] | null> {
  if (!isHighlightableLanguage(lang)) return null;
  return texts.map((text) => bakedLineTokens(lang, text) ?? []);
}

export function tokenClassName(fontStyle: number | undefined): string | undefined {
  if (fontStyle == null || fontStyle <= 0) return undefined;
  const parts: string[] = [];
  if (fontStyle & 1) parts.push("diff-tok-italic");
  if (fontStyle & 2) parts.push("diff-tok-bold");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export type LineTextAt = (index: number) => string;

/** Synchronously apply baked tokens for the current row set. */
export function useHighlightedRange(
  at: LineTextAt,
  length: number,
  lang: string | null,
  _start: number,
  _end: number,
  resetKey: unknown,
): Array<ThemedToken[] | undefined> {
  return useMemo(() => {
    const cache: Array<ThemedToken[] | undefined> = new Array(length);
    for (let i = 0; i < length; i++) {
      const text = at(i);
      if (!text) {
        cache[i] = [];
        continue;
      }
      cache[i] = bakedLineTokens(lang, text) ?? [];
    }
    return cache;
    // resetKey changes when the row model changes (same as desktop hook).
  }, [at, length, lang, resetKey]);
}
