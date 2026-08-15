import { useEffect, useState } from "react";
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

export function useHighlightedLines(
  texts: string[],
  lang: string | null,
): ThemedToken[][] | null {
  const fingerprint = `${lang ?? ""}\0${texts.join("\0")}`;
  const [rows, setRows] = useState<ThemedToken[][] | null>(null);
  const [applied, setApplied] = useState("");

  useEffect(() => {
    if (!isHighlightableLanguage(lang)) {
      setRows(null);
      setApplied(fingerprint);
      return;
    }

    let cancelled = false;
    void highlightLines(texts, lang)
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          setApplied(fingerprint);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows(null);
          setApplied(fingerprint);
        }
      });

    return () => {
      cancelled = true;
    };
    // texts is represented by fingerprint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return applied === fingerprint ? rows : null;
}
