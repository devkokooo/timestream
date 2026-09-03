/**
 * Hard stop for accidental `@pierre/trees/react` imports on the marketing site.
 * Tour file lists go through `PierreFileTree.tsx`.
 */
export function FileTree(): never {
  throw new Error(
    "@pierre/trees/react must not load on the marketing site — use the PierreFileTree mock alias",
  );
}

export function useFileTree(): never {
  throw new Error(
    "@pierre/trees/react must not load on the marketing site — use the PierreFileTree mock alias",
  );
}
