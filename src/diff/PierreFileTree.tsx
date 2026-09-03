import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  themeToTreeStyles,
  type ContextMenuItem,
  type ContextMenuOpenContext,
  type FileTreeOptions,
  type GitStatusEntry,
} from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { TIMESTREAM_TREE_THEME, TIMESTREAM_TREE_UNSAFE_CSS } from "@/diff/pierreTheme";
import { cn } from "@/ui/cn";
import { TvaScrollRails, useTvaScrollTarget } from "@/ui/TvaScrollArea";
import type { FileChange } from "@/git/types";

export type PierreGitStatus = GitStatusEntry["status"];

const TREE_HOST_TAG = "file-tree-container";
const TREE_SCROLL_SEL = '[data-file-tree-virtualized-scroll="true"]';
const ACTION_MENU_MIN_W = 128;

export function gitStatusForFileStatus(status: string): PierreGitStatus {
  switch (status) {
    case "added":
    case "untracked":
    case "deleted":
    case "modified":
      return status;
    case "moved":
    case "copied":
    case "renamed":
      return "renamed";
    default:
      return "modified";
  }
}

export interface PierreFileTreeAction {
  label: string;
  onAction: (path: string) => void | Promise<void>;
}

export interface PierreFileTreeProps {
  files: FileChange[];
  selectedPath: string | null;
  onSelectPath?: (path: string) => void;
  action?: PierreFileTreeAction;
  className?: string;
}

const TREE_THEME_STYLE = themeToTreeStyles(TIMESTREAM_TREE_THEME);

/** Host chrome only — size comes from absolute fill + measured px height. */
const TREE_HOST_CHROME = {
  ...TREE_THEME_STYLE,
  colorScheme: "dark",
  display: "block",
  backgroundColor: "#16120e",
  color: "#f3e2c2",
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  boxSizing: "border-box",
} as CSSProperties;

function filesKey(files: FileChange[]): string {
  return files.map((file) => `${file.status}\0${file.path}\0${file.oldPath ?? ""}`).join("\n");
}

function findTreeScroller(shell: HTMLElement | null): HTMLElement | null {
  const host = shell?.querySelector(TREE_HOST_TAG);
  const root = host?.shadowRoot;
  if (!root) return null;
  return root.querySelector<HTMLElement>(TREE_SCROLL_SEL);
}

function ActionMenuPortal({
  item,
  context,
  action,
}: {
  item: ContextMenuItem;
  context: ContextMenuOpenContext;
  action: PierreFileTreeAction;
}) {
  const rect = context.anchorRect;
  const left = Math.max(8, Math.min(rect.right - ACTION_MENU_MIN_W, window.innerWidth - ACTION_MENU_MIN_W - 8));
  const top = Math.min(rect.bottom + 4, window.innerHeight - 52);

  return createPortal(
    <div
      // Pierre outside-click detection recognizes this attribute via composedPath.
      data-file-tree-context-menu-root="true"
      role="menu"
      className="rounded-md border border-tva-gold/25 bg-[#2d241c] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 10050,
        minWidth: ACTION_MENU_MIN_W,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="w-full border border-tva-gold/35 bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold enabled:hover:border-tva-orange enabled:hover:text-tva-gold-bright"
        onClick={() => {
          context.close({ restoreFocus: false });
          void action.onAction(item.path);
        }}
      >
        {action.label}
      </button>
    </div>,
    document.body,
  );
}

export function PierreFileTree(props: PierreFileTreeProps) {
  return <PierreFileTreeMount key={filesKey(props.files)} {...props} />;
}

function PierreFileTreeMount({
  files,
  selectedPath,
  onSelectPath,
  action,
  className,
}: PierreFileTreeProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [hostPx, setHostPx] = useState(0);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  const paths = useMemo(() => files.map((file) => file.path), [files]);
  const filePathSet = useMemo(() => new Set(paths), [paths]);
  const gitStatus = useMemo(
    (): GitStatusEntry[] =>
      files.map((file) => ({
        path: file.path,
        status: gitStatusForFileStatus(file.status),
      })),
    [files],
  );

  const onSelectRef = useRef(onSelectPath);
  onSelectRef.current = onSelectPath;
  const filePathSetRef = useRef(filePathSet);
  filePathSetRef.current = filePathSet;

  const options = useMemo((): FileTreeOptions => {
    const composition: FileTreeOptions["composition"] = action
      ? {
          contextMenu: {
            enabled: true,
            triggerMode: "both",
            buttonVisibility: "when-needed",
          },
        }
      : undefined;
    return {
      paths,
      gitStatus,
      flattenEmptyDirectories: true,
      initialExpansion: "open",
      initialSelectedPaths: selectedPath && filePathSet.has(selectedPath) ? [selectedPath] : [],
      // Seed virtualizer before first ResizeObserver tick so rows paint immediately.
      initialVisibleRowCount: Math.max(12, paths.length + 4),
      unsafeCSS: TIMESTREAM_TREE_UNSAFE_CSS,
      composition,
      onSelectionChange: (selected) => {
        const next = selected.find((path) => filePathSetRef.current.has(path));
        if (!next) return;
        onSelectRef.current?.(next);
      },
    };
  }, [action, filePathSet, gitStatus, paths, selectedPath]);

  const { model } = useFileTree(options);

  const refreshScroller = useCallback(() => {
    const next = findTreeScroller(shellRef.current);
    setScrollEl((prev) => (prev === next ? prev : next));
  }, []);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const next = Math.round(shell.getBoundingClientRect().height);
      setHostPx((prev) => (prev === next ? prev : next));
    };
    measure();
    refreshScroller();
    const ro = new ResizeObserver(() => {
      measure();
      refreshScroller();
    });
    ro.observe(shell);
    const mo = new MutationObserver(() => refreshScroller());
    mo.observe(shell, { childList: true, subtree: true });
    let ticks = 0;
    const id = window.setInterval(() => {
      refreshScroller();
      ticks += 1;
      if (ticks > 20) window.clearInterval(id);
    }, 100);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearInterval(id);
    };
  }, [refreshScroller]);

  useLayoutEffect(() => {
    const host = shellRef.current?.querySelector(TREE_HOST_TAG);
    const root = host?.shadowRoot;
    if (!root) return;
    const mo = new MutationObserver(() => refreshScroller());
    mo.observe(root, { childList: true, subtree: true });
    refreshScroller();
    return () => mo.disconnect();
  }, [hostPx, refreshScroller]);

  useEffect(() => {
    if (!selectedPath || !filePathSet.has(selectedPath)) return;
    model.getItem(selectedPath)?.select();
  }, [filePathSet, model, selectedPath]);

  const yScroll = useTvaScrollTarget(scrollEl, { axis: "y", deep: true });
  const { showY, railPx, measure } = yScroll;

  useEffect(() => {
    return model.subscribe(() => {
      measure();
      refreshScroller();
    });
  }, [measure, model, refreshScroller]);

  if (files.length === 0) return null;

  const hostStyle: CSSProperties = {
    ...TREE_HOST_CHROME,
    position: "absolute",
    top: 0,
    left: 0,
    right: showY ? railPx : 0,
    bottom: 0,
    width: "auto",
    height: hostPx > 0 ? `${hostPx}px` : "100%",
    minHeight: hostPx > 0 ? `${hostPx}px` : undefined,
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "tva-scroll relative h-full min-h-0 w-full flex-1",
        showY && "has-y",
        className,
      )}
      style={{ "--tva-sb": `${railPx}px` } as CSSProperties}
    >
      <FileTree
        model={model}
        className="block overflow-hidden"
        style={hostStyle}
        renderContextMenu={
          action
            ? (item, context) => {
                if (!filePathSet.has(item.path)) return null;
                return <ActionMenuPortal item={item} context={context} action={action} />;
              }
            : undefined
        }
      />
      <TvaScrollRails
        showY={showY}
        showX={false}
        yStyle={yScroll.yStyle}
        xStyle={yScroll.xStyle}
        jumpY={yScroll.jumpY}
        jumpX={yScroll.jumpX}
        startDragY={yScroll.startDragY}
        startDragX={yScroll.startDragX}
      />
    </div>
  );
}
