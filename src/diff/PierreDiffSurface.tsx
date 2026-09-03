import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CodeView,
  type CodeViewItem,
  type CodeViewReactOptions,
  type DiffLineAnnotation,
} from "@pierre/diffs/react";
import { hunkKey } from "@/diff/diffView";
import { HunkHeader } from "@/diff/HunkHeader";
import { toPierreFileDiff } from "@/diff/pierrePatch";
import {
  TIMESTREAM_DIFF_VARS,
  TIMESTREAM_THEME,
  TIMESTREAM_UNSAFE_CSS,
} from "@/diff/pierreTheme";
import type { DiffHunk, DiffMode, FileDiff, PierreFileContents } from "@/diff/types";
import type { ReviewComment } from "@/github/reviews/types";
import { PersonName } from "@/auth/PersonName";
import { emptyText } from "@/ui/ui";
import { cn } from "@/ui/cn";
import { TvaScrollRails, useTvaScrollTarget } from "@/ui/TvaScrollArea";

export type DiffSidesLoader = () => Promise<{
  oldFile: PierreFileContents | null;
  newFile: PierreFileContents | null;
}>;

export interface PierreDiffSurfaceProps {
  diff: FileDiff;
  mode: DiffMode;
  /** Enable mark-as-read collapse on per-hunk sticky headers. */
  reviewable?: boolean;
  readKeys?: ReadonlySet<string>;
  onToggleRead?: (key: string) => void;
  reviewComments?: ReviewComment[];
  loadSides?: DiffSidesLoader;
}

type NoteMeta = { id: number; login: string; body: string };

const CODE_VIEW_STYLE = {
  position: "absolute",
  top: 0,
  left: 0,
  overflow: "auto",
  ...TIMESTREAM_DIFF_VARS,
} as CSSProperties;

function annotationSide(side: string | null): "additions" | "deletions" {
  return side === "LEFT" || side === "left" ? "deletions" : "additions";
}

function itemId(path: string, key: string): string {
  return `diff:${path}:${key}`;
}

function parseItemKey(id: string, path: string): string | null {
  const prefix = `diff:${path}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

/** Pierre keeps long-line horizontal scroll on shadow `[data-code]` nodes. */
function findPierreCodeScrollers(host: HTMLElement | null): HTMLElement[] {
  const root = host?.shadowRoot;
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>("[data-code]"));
}

function pickPrimaryCodeScroller(nodes: HTMLElement[]): HTMLElement | null {
  if (nodes.length === 0) return null;
  let best = nodes[0];
  let bestOverflow = best.scrollWidth - best.clientWidth;
  for (let i = 1; i < nodes.length; i += 1) {
    const overflow = nodes[i].scrollWidth - nodes[i].clientWidth;
    if (overflow > bestOverflow) {
      best = nodes[i];
      bestOverflow = overflow;
    }
  }
  return best;
}

function hunkInRange(hunk: DiffHunk, line: number): boolean {
  const end = hunk.newStart + Math.max(hunk.newLines, 1) - 1;
  return line >= hunk.newStart && line <= end;
}

export function PierreDiffSurface({
  diff,
  mode,
  reviewable = false,
  readKeys,
  onToggleRead,
  reviewComments,
  loadSides,
}: PierreDiffSurfaceProps) {
  // Stable per-hunk Pierre metadata so loadDiffFiles hydration survives re-renders.
  const metaByKeyRef = useRef(new Map<string, NonNullable<ReturnType<typeof toPierreFileDiff>>>());
  const metaSourceRef = useRef("");
  const sourceKey = `${diff.path}|${diff.oldPath ?? ""}|${diff.status}|${diff.hunks.map((h) => hunkKey(h)).join(";")}`;
  if (metaSourceRef.current !== sourceKey) {
    metaSourceRef.current = sourceKey;
    metaByKeyRef.current = new Map();
    for (const hunk of diff.hunks) {
      const key = hunkKey(hunk);
      const meta = toPierreFileDiff(
        { ...diff, hunks: [hunk] },
        { cacheKeyPrefix: `ts:${diff.path}:${key}` },
      );
      if (meta) metaByKeyRef.current.set(key, meta);
    }
  }

  const hunkByKey = useMemo(() => {
    const map = new Map<string, DiffHunk>();
    for (const hunk of diff.hunks) map.set(hunkKey(hunk), hunk);
    return map;
  }, [diff.hunks]);

  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const [codeScrollers, setCodeScrollers] = useState<HTMLElement[]>([]);

  const refreshCodeScrollers = useCallback(() => {
    const next = findPierreCodeScrollers(hostEl);
    setCodeScrollers((prev) => {
      if (prev.length === next.length && prev.every((el, i) => el === next[i])) return prev;
      return next;
    });
  }, [hostEl]);

  useLayoutEffect(() => {
    refreshCodeScrollers();
    const host = hostEl;
    if (!host) return;
    const root = host.shadowRoot;
    const mo = new MutationObserver(() => refreshCodeScrollers());
    mo.observe(host, { childList: true, subtree: true });
    if (root) mo.observe(root, { childList: true, subtree: true });
    const ro = root ? new ResizeObserver(() => refreshCodeScrollers()) : null;
    if (root && ro) {
      for (const node of root.querySelectorAll("[data-code]")) ro.observe(node);
    }
    let ticks = 0;
    const id = window.setInterval(() => {
      refreshCodeScrollers();
      ticks += 1;
      if (ticks > 20) window.clearInterval(id);
    }, 250);
    return () => {
      mo.disconnect();
      ro?.disconnect();
      window.clearInterval(id);
    };
  }, [hostEl, refreshCodeScrollers]);

  const primaryCode = useMemo(() => pickPrimaryCodeScroller(codeScrollers), [codeScrollers]);
  const syncTargets = useMemo(() => codeScrollers, [codeScrollers]);

  const yScroll = useTvaScrollTarget(hostEl, { axis: "y", deep: true });
  const xScroll = useTvaScrollTarget(primaryCode, {
    axis: "x",
    deep: true,
    syncTargets,
  });

  const showY = yScroll.showY;
  const showX = xScroll.showX;
  const railPx = yScroll.railPx;

  const annotationsByKey = useMemo(() => {
    const map = new Map<string, DiffLineAnnotation<NoteMeta>[]>();
    if (!reviewComments?.length) return map;
    for (const hunk of diff.hunks) {
      const key = hunkKey(hunk);
      const notes = reviewComments
        .filter((c) => c.path === diff.path || c.path === diff.oldPath)
        .filter((c) => c.line != null && c.line > 0 && hunkInRange(hunk, c.line!))
        .map((c) => ({
          side: annotationSide(c.side),
          lineNumber: c.line!,
          metadata: { id: c.id, login: c.userLogin, body: c.body },
        }));
      if (notes.length > 0) map.set(key, notes);
    }
    return map;
  }, [diff.hunks, diff.oldPath, diff.path, reviewComments]);

  const readSig = useMemo(() => {
    if (!readKeys || readKeys.size === 0) return "";
    return [...readKeys].sort().join(",");
  }, [readKeys]);

  const items = useMemo((): CodeViewItem<NoteMeta>[] => {
    const out: CodeViewItem<NoteMeta>[] = [];
    for (const hunk of diff.hunks) {
      const key = hunkKey(hunk);
      const fileDiff = metaByKeyRef.current.get(key);
      if (!fileDiff) continue;
      const read = Boolean(reviewable && readKeys?.has(key));
      let version = 0;
      const versionKey = `${mode}|${key}|${read ? 1 : 0}|${annotationsByKey.get(key)?.length ?? 0}`;
      for (let i = 0; i < versionKey.length; i += 1) {
        version = (version * 31 + versionKey.charCodeAt(i)) | 0;
      }
      out.push({
        id: itemId(diff.path, key),
        type: "diff",
        fileDiff,
        annotations: annotationsByKey.get(key),
        collapsed: read,
        version: Math.abs(version),
      });
    }
    return out;
  }, [annotationsByKey, diff.hunks, diff.path, mode, readKeys, readSig, reviewable]);

  const loadDiffFiles = useCallback(async () => {
    if (!loadSides) {
      return {
        oldFile: null as null,
        newFile: { name: diff.path, contents: "", cacheKey: `empty:${diff.path}` },
      };
    }
    const { oldFile, newFile } = await loadSides();
    if (oldFile && newFile) return { oldFile, newFile };
    if (newFile) return { oldFile: null, newFile };
    if (oldFile) {
      return {
        oldFile,
        newFile: {
          name: diff.path,
          contents: "",
          cacheKey: `${oldFile.cacheKey ?? oldFile.name}:empty-new`,
        },
      };
    }
    return {
      oldFile: null,
      newFile: { name: diff.path, contents: "", cacheKey: `empty:${diff.path}` },
    };
  }, [diff.path, loadSides]);

  const options = useMemo((): CodeViewReactOptions<NoteMeta> => {
    const base: CodeViewReactOptions<NoteMeta> = {
      theme: TIMESTREAM_THEME,
      themeType: "dark",
      diffStyle: mode === "split" ? "split" : "unified",
      diffIndicators: "classic",
      // Titles live in sticky custom headers; keep separators minimal.
      hunkSeparators: "simple",
      disableFileHeader: false,
      overflow: "scroll",
      unsafeCSS: TIMESTREAM_UNSAFE_CSS,
      stickyHeaders: true,
      itemMetrics: {
        // Match .diff-hunk-header / DIFF_HEADER_HEIGHT for sticky math.
        diffHeaderHeight: 36,
        lineHeight: 19,
        spacing: 8,
      },
      layout: { paddingTop: 8, paddingBottom: 16, gap: 8 },
      expansionLineCount: 20,
    };
    if (loadSides) {
      base.loadDiffFiles = loadDiffFiles;
    }
    return base;
  }, [loadDiffFiles, loadSides, mode]);

  const codeViewStyle = useMemo((): CSSProperties => {
    return {
      ...CODE_VIEW_STYLE,
      right: showY ? railPx : 0,
      bottom: showX ? railPx : 0,
    };
  }, [railPx, showX, showY]);

  if (items.length === 0) {
    return (
      <div className="pierre-diff-host relative min-h-0 flex-1">
        <p className={cn(emptyText, "px-3 py-2")}>Could not render variance record.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pierre-diff-host tva-scroll relative min-h-0 flex-1",
        showY && "has-y",
        showX && "has-x",
      )}
      style={{ "--tva-sb": `${railPx}px` } as CSSProperties}
    >
      <CodeView
        className="pierre-diff-codeview"
        style={codeViewStyle}
        containerRef={setHostEl}
        disableWorkerPool
        items={items}
        options={options}
        onScroll={() => {
          yScroll.measure();
          xScroll.measure();
          refreshCodeScrollers();
        }}
        renderCustomHeader={(item) => {
          const key = parseItemKey(item.id, diff.path);
          const hunk = key ? hunkByKey.get(key) : undefined;
          if (!hunk || !key) return null;
          const read = Boolean(reviewable && readKeys?.has(key));
          return (
            <HunkHeader
              hunk={hunk}
              reviewable={reviewable}
              read={read}
              onToggleRead={onToggleRead ? () => onToggleRead(key) : undefined}
              sticky
            />
          );
        }}
        renderAnnotation={(annotation) => {
          if (!("metadata" in annotation) || !annotation.metadata) return null;
          const note = annotation.metadata;
          return (
            <div className="px-2.5 py-1.5 text-[11px] text-tva-paper-dim">
              L{annotation.lineNumber} <PersonName name={note.login} login={note.login} />: {note.body}
            </div>
          );
        }}
      />
      <TvaScrollRails
        showY={showY}
        showX={showX}
        yStyle={yScroll.yStyle}
        xStyle={xScroll.xStyle}
        jumpY={yScroll.jumpY}
        jumpX={xScroll.jumpX}
        startDragY={yScroll.startDragY}
        startDragX={xScroll.startDragX}
      />
    </div>
  );
}
