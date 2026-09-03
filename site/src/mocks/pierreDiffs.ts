/**
 * Hard stop for accidental `@pierre/diffs` imports on the marketing site.
 * Tour diffs go through `PierreDiffSurface.tsx` (baked-token body).
 */
throw new Error(
  "@pierre/diffs must not load on the marketing site — use the PierreDiffSurface mock alias",
);
