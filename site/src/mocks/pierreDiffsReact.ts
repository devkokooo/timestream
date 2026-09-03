/**
 * Hard stop for accidental `@pierre/diffs/react` imports on the marketing site.
 * Tour diffs go through `PierreDiffSurface.tsx` (baked-token body).
 */
export function CodeView(): never {
  throw new Error(
    "@pierre/diffs/react must not load on the marketing site — use the PierreDiffSurface mock alias",
  );
}
