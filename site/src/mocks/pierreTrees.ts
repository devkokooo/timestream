/**
 * Hard stop for accidental `@pierre/trees` imports on the marketing site.
 * Tour file lists go through `PierreFileTree.tsx`.
 */
throw new Error(
  "@pierre/trees must not load on the marketing site — use the PierreFileTree mock alias",
);
