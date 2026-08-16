/** Teletype glyphs — mostly binary, with punch-card punctuation. */
export const JUMBLE_BINARY = "01";
export const JUMBLE_GLYPHS = "01ABCDEF.:|#*+";

export function jumbleGlyph(rng: () => number): string {
  if (rng() < 0.72) {
    return JUMBLE_BINARY[Math.floor(rng() * JUMBLE_BINARY.length)]!;
  }
  return JUMBLE_GLYPHS[Math.floor(rng() * JUMBLE_GLYPHS.length)]!;
}

/** Fixed-width ticker frame, grouped in fours like a 50s tape. */
export function jumbleFrame(length = 12, rng: () => number = Math.random): string {
  const raw = Array.from({ length }, () => jumbleGlyph(rng)).join("");
  return raw.replace(/(.{4})/g, "$1 ").trim();
}
