import { describe, expect, it } from "vitest";
import { jumbleFrame, jumbleGlyph } from "./jumble";

describe("jumbleGlyph", () => {
  it("picks binary when the first roll is low", () => {
    const rolls = [0.1, 0];
    let i = 0;
    expect(jumbleGlyph(() => rolls[i++] ?? 0)).toBe("0");
  });

  it("picks a punch-card glyph when the first roll is high", () => {
    const rolls = [0.9, 0.99];
    let i = 0;
    expect(jumbleGlyph(() => rolls[i++] ?? 0)).toBe("+");
  });
});

describe("jumbleFrame", () => {
  it("emits grouped glyphs of the requested length", () => {
    const frame = jumbleFrame(12, () => 0);
    expect(frame.replace(/ /g, "")).toHaveLength(12);
    expect(frame).toBe("0000 0000 0000");
  });

  it("only uses the teletype alphabet", () => {
    let n = 0;
    const frame = jumbleFrame(16, () => {
      n += 0.07;
      return n % 1;
    });
    expect(frame.replace(/ /g, "")).toMatch(/^[01ABCDEF.:|#*+]+$/);
  });
});
