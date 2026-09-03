/** Built-in Shiki theme — available synchronously (token colors only). */
export const TIMESTREAM_THEME = "gruvbox-dark-hard";

const TVA_BG = "#16120e";
const TVA_FG = "#f3e2c2";
const TVA_MUTED = "#9a8b74";
const TVA_GOLD = "#e8b86d";
const TVA_ADD = "#c6d18d";
const TVA_DEL = "#ff8a6a";
const TVA_ADD_BG = "rgba(143, 154, 98, 0.16)";
const TVA_DEL_BG = "rgba(194, 59, 34, 0.16)";
const TVA_SEP = "#241c16";
/** Stripe ink for split empty/buffer cells (Pierre `[data-content-buffer]`). */
const TVA_BUFFER_STRIPE = "rgba(232, 184, 109, 0.14)";

/**
 * Host CSS variables. Pierre recomputes `--diffs-bg` from `--diffs-dark-bg`
 * inside `:host`, so both must be set; use `*-override` for wash colors.
 */
export const TIMESTREAM_DIFF_VARS = {
  "--diffs-font-family": '"JetBrains Mono", ui-monospace, monospace',
  "--diffs-header-font-family": '"JetBrains Mono", ui-monospace, monospace',
  "--diffs-font-size": "12px",
  "--diffs-line-height": "19px",
  "--diffs-tab-size": "4",
  "--diffs-dark-bg": TVA_BG,
  "--diffs-light-bg": TVA_BG,
  "--diffs-bg": TVA_BG,
  "--diffs-dark": TVA_FG,
  "--diffs-light": TVA_FG,
  "--diffs-fg": TVA_FG,
  "--diffs-fg-muted": TVA_MUTED,
  "--diffs-fg-number-override": TVA_MUTED,
  "--diffs-bg-context-override": TVA_BG,
  "--diffs-bg-context-gutter-override": TVA_BG,
  "--diffs-bg-buffer-override": TVA_BUFFER_STRIPE,
  "--diffs-bg-separator-override": TVA_SEP,
  "--diffs-bg-addition-override": TVA_ADD_BG,
  "--diffs-bg-deletion-override": TVA_DEL_BG,
  "--diffs-dark-addition-color": TVA_ADD,
  "--diffs-dark-deletion-color": TVA_DEL,
  "--diffs-addition-color": TVA_ADD,
  "--diffs-deletion-color": TVA_DEL,
  "--diffs-gap-style": `1px solid rgba(232, 184, 109, 0.1)`,
} as const;

/** Shadow-DOM overrides for TVA chrome + separators. */
export const TIMESTREAM_UNSAFE_CSS = `
:host {
  --diffs-dark-bg: ${TVA_BG} !important;
  --diffs-light-bg: ${TVA_BG} !important;
  --diffs-bg: ${TVA_BG} !important;
  --diffs-bg-context: ${TVA_BG} !important;
  --diffs-bg-context-gutter: ${TVA_BG} !important;
  --diffs-bg-buffer: ${TVA_BUFFER_STRIPE} !important;
  --diffs-bg-separator: ${TVA_SEP} !important;
  --diffs-bg-addition: ${TVA_ADD_BG} !important;
  --diffs-bg-deletion: ${TVA_DEL_BG} !important;
  --diffs-addition-base: ${TVA_ADD} !important;
  --diffs-deletion-base: ${TVA_DEL} !important;
  --diffs-fg: ${TVA_FG} !important;
  --diffs-fg-number: ${TVA_MUTED} !important;
  background: ${TVA_BG} !important;
  background-color: ${TVA_BG} !important;
  color: ${TVA_FG};
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
:host::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent !important;
}
[data-diffs],
pre,
code,
[data-gutter],
[data-content],
[data-code] {
  background-color: ${TVA_BG} !important;
}
[data-gutter] {
  border-right: 1px solid rgba(232, 184, 109, 0.1);
  color: ${TVA_MUTED};
}
[data-column-number] {
  color: ${TVA_MUTED} !important;
}
[data-line-type="change-addition"],
[data-line-type="addition"],
[data-line-type="additions"] {
  --diffs-computed-diff-line-bg: ${TVA_ADD_BG} !important;
  --diffs-line-bg: ${TVA_ADD_BG} !important;
  background-color: ${TVA_ADD_BG} !important;
  color: ${TVA_ADD};
}
[data-line-type="change-deletion"],
[data-line-type="deletion"],
[data-line-type="deletions"] {
  --diffs-computed-diff-line-bg: ${TVA_DEL_BG} !important;
  --diffs-line-bg: ${TVA_DEL_BG} !important;
  background-color: ${TVA_DEL_BG} !important;
  color: ${TVA_DEL};
}
[data-line-type="change-addition"]::before {
  color: ${TVA_ADD} !important;
}
[data-line-type="change-deletion"]::before {
  color: ${TVA_DEL} !important;
}
[data-separator="simple"],
[data-separator="line-info-basic"],
[data-separator="line-info"],
[data-separator="metadata"] {
  background-color: ${TVA_SEP} !important;
  color: ${TVA_GOLD};
}
[data-separator="line-info-basic"] {
  height: auto;
  min-height: 28px;
  border-block: 1px solid rgba(232, 184, 109, 0.14);
  font-family: var(--diffs-font-family);
  font-size: 11px;
}
[data-separator="simple"] {
  min-height: 4px;
}
[data-separator-wrapper],
[data-expand-button],
[data-separator-content] {
  background-color: ${TVA_SEP} !important;
  color: ${TVA_GOLD} !important;
  font-family: var(--diffs-font-family);
}
[data-expand-button]:hover,
[data-separator-content]:hover {
  color: #f4c430 !important;
}
[data-content-buffer] {
  background-color: ${TVA_BG} !important;
  background-position: 5px 0;
  background-size: 8px 8px;
  background-origin: border-box;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent calc(3px * 1.414),
    ${TVA_BUFFER_STRIPE} calc(3px * 1.414),
    ${TVA_BUFFER_STRIPE} calc(4px * 1.414)
  ) !important;
}
[data-gutter-buffer="buffer"] {
  --diffs-line-bg: ${TVA_BG} !important;
  background-color: ${TVA_BG} !important;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent calc(3px * 1.414),
    ${TVA_BUFFER_STRIPE} calc(3px * 1.414),
    ${TVA_BUFFER_STRIPE} calc(4px * 1.414)
  ) !important;
  background-size: 8px 8px;
}

/* Per-hunk sticky custom headers (renderCustomHeader → TVA HunkHeader). */
[data-diffs-header] {
  background: transparent !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  border: none !important;
  align-items: stretch !important;
}
[data-diffs-header][data-sticky],
[data-diffs-header="default"][data-sticky] {
  z-index: 6 !important;
  background: ${TVA_BG} !important;
  box-shadow: 0 -16px 0 2px ${TVA_BG};
}
[data-diffs-header] [data-header-content],
[data-diffs-header] [data-metadata],
[data-diffs-header] [data-change-icon],
[data-diffs-header] [data-title],
[data-diffs-header] [data-prev-name],
[data-diffs-header] [data-additions-count],
[data-diffs-header] [data-deletions-count] {
  display: none !important;
}

/* Inner horizontal scroller ([data-code]) — hide native bar; TVA X rail is light-DOM. */
[data-code] {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
[data-code]::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent !important;
}
`;

/** VS Code-shaped theme for `themeToTreeStyles` — TVA board, not Pierre cyan. */
export const TIMESTREAM_TREE_THEME = {
  name: "timestream-tva",
  type: "dark" as const,
  bg: TVA_BG,
  fg: TVA_FG,
  colors: {
    "sideBar.background": TVA_BG,
    "sideBar.foreground": TVA_FG,
    "sideBar.border": TVA_SEP,
    "sideBarSectionHeader.foreground": TVA_MUTED,
    "list.activeSelectionBackground": "rgba(232, 93, 4, 0.22)",
    "list.activeSelectionForeground": "#f4c430",
    "list.focusBackground": "rgba(232, 93, 4, 0.18)",
    "list.focusOutline": "#e85d04",
    "list.hoverBackground": "rgba(232, 93, 4, 0.10)",
    "editor.selectionBackground": "rgba(232, 93, 4, 0.22)",
    "input.background": "#120e0b",
    "input.border": "rgba(232, 184, 109, 0.25)",
    "scrollbarSlider.background": "rgba(232, 93, 4, 0.45)",
    "gitDecoration.addedResourceForeground": TVA_ADD,
    "gitDecoration.modifiedResourceForeground": TVA_GOLD,
    "gitDecoration.deletedResourceForeground": TVA_DEL,
    "gitDecoration.untrackedResourceForeground": "#e8d5a3",
    "gitDecoration.renamedResourceForeground": "#ff7a1a",
  },
};

/** Shadow-DOM overrides — host `light-dark()` defaults otherwise fight TVA. */
export const TIMESTREAM_TREE_UNSAFE_CSS = `
:host {
  color-scheme: dark !important;
  --trees-accent-override: #e85d04;
  --trees-fg-override: ${TVA_FG} !important;
  --trees-fg-muted-override: ${TVA_MUTED} !important;
  --trees-bg-override: ${TVA_BG} !important;
  --trees-font-family-override: "JetBrains Mono", ui-monospace, monospace;
  --trees-font-size-override: 12px;
  --trees-selected-bg-override: rgba(232, 93, 4, 0.18);
  --trees-selected-fg-override: #f4c430;
  --trees-status-added-override: ${TVA_ADD};
  --trees-status-modified-override: ${TVA_GOLD};
  --trees-status-deleted-override: ${TVA_DEL};
  --trees-status-renamed-override: #ff7a1a;
  --trees-status-untracked-override: #e8d5a3;
  background: ${TVA_BG} !important;
  color: ${TVA_FG} !important;
  scrollbar-width: none !important;
}
:host::-webkit-scrollbar,
[data-file-tree-virtualized-root]::-webkit-scrollbar,
[data-file-tree-virtualized-scroll="true"]::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}
[data-file-tree-virtualized-scroll="true"] {
  scrollbar-width: none !important;
  scrollbar-gutter: auto !important;
}
`;
