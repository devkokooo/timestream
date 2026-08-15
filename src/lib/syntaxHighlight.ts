import { useEffect, useRef, useState } from "react";
import {
  bundledLanguages,
  getSingletonHighlighter,
  type BundledLanguage,
  type ThemedToken,
} from "shiki";

export type { ThemedToken };

/** Gruvbox Dark Hard remapped onto TVA paper / orange / gold / stamp. */
const THEME = "gruvbox-dark-hard";

const TVA_COLOR_REPLACEMENTS: Record<string, string> = {
  "#ebdbb2": "#f3e2c2",
  "#d5c4a1": "#e8d4b0",
  "#bdae93": "#d4c19a",
  "#a89984": "#9a8b74",
  "#928374": "#9a8b74",
  "#fe8019": "#e85d04",
  "#d65d0e": "#e85d04",
  "#fabd2f": "#f4c430",
  "#d79921": "#e8b86d",
  "#fb4934": "#e07050",
  "#cc241d": "#c23b22",
  "#b8bb26": "#c6d18d",
  "#98971a": "#8f9a62",
};

export function isHighlightableLanguage(lang: string | null): lang is BundledLanguage {
  return lang != null && lang in bundledLanguages;
}

export async function highlightLines(
  texts: string[],
  lang: string | null,
): Promise<ThemedToken[][] | null> {
  if (!isHighlightableLanguage(lang)) return null;

  const highlighter = await getSingletonHighlighter({
    themes: [THEME],
    langs: [lang],
  });

  return texts.map((text) => {
    const { tokens } = highlighter.codeToTokens(text, {
      lang,
      theme: THEME,
      colorReplacements: TVA_COLOR_REPLACEMENTS,
    });
    return tokens[0] ?? [];
  });
}

export function tokenClassName(fontStyle: number | undefined): string | undefined {
  if (fontStyle == null || fontStyle <= 0) return undefined;
  const parts: string[] = [];
  if (fontStyle & 1) parts.push("diff-tok-italic");
  if (fontStyle & 2) parts.push("diff-tok-bold");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export type LineTextAt = (index: number) => string;

/** Tokenize visible lines and cache by index. Headers / empty strings skip Shiki. */
export function useHighlightedRange(
  at: LineTextAt,
  length: number,
  lang: string | null,
  start: number,
  end: number,
  resetKey: unknown,
): Array<ThemedToken[] | undefined> {
  const cacheRef = useRef<Array<ThemedToken[] | undefined>>([]);
  const keyRef = useRef(resetKey);
  keyRef.current = resetKey;
  const [, bump] = useState(0);

  useEffect(() => {
    cacheRef.current = new Array(length);
    bump((n) => n + 1);
  }, [length, lang, resetKey]);

  useEffect(() => {
    if (!isHighlightableLanguage(lang)) return;

    const cache = cacheRef.current;
    const lo = Math.max(0, start);
    const hi = Math.min(length, Math.max(lo, end));
    const missing: number[] = [];
    let filledEmpty = false;
    for (let i = lo; i < hi; i++) {
      if (cache[i] !== undefined) continue;
      if (!at(i)) {
        cache[i] = [];
        filledEmpty = true;
        continue;
      }
      missing.push(i);
    }
    if (filledEmpty) bump((n) => n + 1);
    if (missing.length === 0) return;

    let cancelled = false;
    void highlightLines(
      missing.map((i) => at(i)),
      lang,
    )
      .then((rows) => {
        if (cancelled || keyRef.current !== resetKey) return;
        if (!rows) {
          missing.forEach((index) => {
            cacheRef.current[index] = [];
          });
        } else {
          missing.forEach((index, j) => {
            cacheRef.current[index] = rows[j];
          });
        }
        bump((n) => n + 1);
      })
      .catch(() => {
        if (cancelled || keyRef.current !== resetKey) return;
        missing.forEach((index) => {
          cacheRef.current[index] = [];
        });
        bump((n) => n + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [at, end, lang, length, resetKey, start]);

  return cacheRef.current;
}
