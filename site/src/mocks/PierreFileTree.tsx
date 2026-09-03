import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { FileChange } from "../../../src/git/types";
import { cn } from "../../../src/ui/cn";
import {
  actionMark,
  actionTone,
  fileDisplayName,
} from "../../../src/diff/diffView";
import { actionColor, fileRowSelected } from "../../../src/ui/ui";

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

type DirNode = {
  name: string;
  path: string;
  dirs: Map<string, DirNode>;
  files: FileChange[];
};

function buildDirTree(files: FileChange[]): DirNode {
  const root: DirNode = { name: "", path: "", dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let dir = root;
    let prefix = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      prefix = prefix ? `${prefix}/${part}` : part;
      const next = dir.dirs.get(part) ?? {
        name: part,
        path: prefix,
        dirs: new Map(),
        files: [],
      };
      if (!dir.dirs.has(part)) dir.dirs.set(part, next);
      dir = next;
    }
    dir.files.push(file);
  }
  return flattenEmptyDirectories(root);
}

/** Match Pierre `flattenEmptyDirectories`: fold `a/ → b/` into `a/b` when b is the only child. */
function flattenEmptyDirectories(node: DirNode): DirNode {
  const dirs = new Map<string, DirNode>();
  for (const child of node.dirs.values()) {
    let collapsed = flattenEmptyDirectories(child);
    while (collapsed.dirs.size === 1 && collapsed.files.length === 0) {
      const only = collapsed.dirs.values().next().value as DirNode;
      collapsed = {
        name: `${collapsed.name}/${only.name}`,
        path: only.path,
        dirs: only.dirs,
        files: only.files,
      };
    }
    dirs.set(collapsed.path, collapsed);
  }
  return { name: node.name, path: node.path, dirs, files: node.files };
}

function sortedDirs(dir: DirNode): DirNode[] {
  return Array.from(dir.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sortedFiles(dir: DirNode): FileChange[] {
  return [...dir.files].sort((a, b) => a.path.localeCompare(b.path));
}

function toggleDir(path: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

export function PierreFileTree({ files, selectedPath, onSelectPath, action, className }: PierreFileTreeProps) {
  const dirTree = useMemo(() => buildDirTree(files), [files]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const allDirs = new Set<string>();
    const walk = (dir: DirNode) => {
      for (const child of dir.dirs.values()) {
        allDirs.add(child.path);
        walk(child);
      }
    };
    walk(dirTree);
    setExpanded(allDirs);
  }, [dirTree]);

  const renderDir = (dir: DirNode, depth: number): ReactElement[] => {
    const out: ReactElement[] = [];

    for (const child of sortedDirs(dir)) {
      const isOpen = expanded.has(child.path);
      out.push(
        <button
          key={`d:${child.path}`}
          type="button"
          className="flex w-full cursor-pointer select-none items-center gap-2 border-0 bg-transparent py-[6px] pr-1 text-left font-mono text-[12px] leading-[19px] text-tva-gold hover:bg-tva-orange/10"
          style={{ paddingLeft: depth * 12 + 6 }}
          onClick={() => setExpanded((current) => toggleDir(child.path, current))}
        >
          <span className="mr-2 inline-block w-[12px] shrink-0 text-center text-[12px]" aria-hidden>
            {isOpen ? "▾" : "▸"}
          </span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
            {child.name}
          </span>
        </button>,
      );
      if (isOpen) out.push(...renderDir(child, depth + 1));
    }

    for (const file of sortedFiles(dir)) {
      const tone = actionTone(file.status);
      const mark = actionMark(file.status);
      const selected = selectedPath === file.path;
      const badgeCls = actionColor[tone] ?? "text-tva-gold";

      out.push(
        <div
          key={`f:${file.path}`}
          className={cn(
            "group flex w-full cursor-pointer items-center justify-between gap-2 border-0 border-b border-dashed border-tva-gold/12 bg-transparent py-1.5 pr-1 text-left font-mono text-[12px] leading-[19px] hover:bg-tva-orange/8",
            selected && fileRowSelected,
            badgeCls,
          )}
          style={{ paddingLeft: depth * 12 + 6 }}
          role="button"
          tabIndex={0}
          onClick={() => onSelectPath?.(file.path)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectPath?.(file.path);
            }
          }}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
              {fileDisplayName(file)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.12em]">{mark}</span>
            {action ? (
              <button
                type="button"
                className="shrink-0 cursor-pointer border border-tva-gold/35 bg-transparent px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold enabled:hover:border-tva-orange enabled:hover:text-tva-gold-bright disabled:hover:border-tva-gold/35 disabled:hover:text-tva-gold"
                onClick={(e) => {
                  e.stopPropagation();
                  void action.onAction(file.path);
                }}
              >
                {action.label}
              </button>
            ) : null}
          </div>
        </div>,
      );
    }

    return out;
  };

  return (
    // Absolute px type — site html is 130% and rem-based Tailwind would inflate rows.
    <div
      className={cn(
        "h-full min-h-0 overflow-auto bg-[#16120e] font-mono text-[12px] leading-[19px] text-tva-paper",
        className,
      )}
    >
      {renderDir(dirTree, 0)}
    </div>
  );
}
