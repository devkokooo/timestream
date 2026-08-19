import { describe, expect, it } from "vitest";
import { highlightLines, tokenClassName } from "@/diff/syntaxHighlight";

describe("tokenClassName", () => {
  it("maps italic and bold flags", () => {
    expect(tokenClassName(undefined)).toBeUndefined();
    expect(tokenClassName(0)).toBeUndefined();
    expect(tokenClassName(1)).toBe("diff-tok-italic");
    expect(tokenClassName(2)).toBe("diff-tok-bold");
    expect(tokenClassName(3)).toBe("diff-tok-italic diff-tok-bold");
  });
});

describe("highlightLines", () => {
  it("returns null for unknown languages", async () => {
    expect(await highlightLines(["x"], null)).toBeNull();
    expect(await highlightLines(["x"], "not-a-real-lang")).toBeNull();
  });

  it("tokenizes major languages with TVA remapped colors", async () => {
    const samples: Array<[string, string]> = [
      ["typescript", "const sacred = 1;"],
      ["rust", "fn nexus(x: i32) -> i32 { x }"],
      ["python", "def variant(name: str) -> str:"],
      ["go", "func main() { println(1) }"],
      ["json", '{"branch":"sacred"}'],
    ];

    for (const [lang, source] of samples) {
      const rows = await highlightLines([source], lang);
      expect(rows, lang).toHaveLength(1);
      expect(rows![0].some((token) => token.color), lang).toBe(true);
      const colors = new Set(rows![0].map((token) => token.color).filter(Boolean));
      expect(colors.size, lang).toBeGreaterThan(1);
    }
  });
});
