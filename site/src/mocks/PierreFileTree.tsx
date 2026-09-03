import { useEffect, useMemo, useState } from "react";
import type { FileChange } from "../../../src/git/types";
import { cn } from "../../../src/ui/cn";
import {
  actionMark,
  actionTone,
  fileDisplayName,
  fileDisplayPath,
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
  return root;
}

function sortedDirs(dir: DirNode): DirNode[] {
  return Array.from(dir.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sortedFiles(dir: DirNode): FileChange[] {
  return [...dir.files].sort((a, b) => a.path.localeCompare(b.path));
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

  const renderDir = (dir: DirNode, depth: number): JSX.Element[] => {
    const out: JSX.Element[] = [];

    for (const child of sortedDirs(dir)) {
      const isOpen = expanded.has(child.path);
      out.push(
        <div
          key={`d:${child.path}`}
          className="flex w-full select-none items-center gap-2 border-0 bg-transparent py-[6px] pr-1 text-left font-mono text-[12px] text-tva-gold hover:bg-tva-orange/10"
          style={{ paddingLeft: depth * 12 + 6 }}
        >
          <button
            type="button"
            className="border-0 bg-transparent p-0 text-left"
            onClick={() => {
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(child.path)) next.delete(child.path);
                else next.add(child.path);
                return next;
              });
            }}
          >
            <span className="mr-2 inline-block w-[12px] text-center" aria-hidden>
              {isOpen ? "▾" : "▸"}
            </span>
            {child.name}
          </button>
        </div>,
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
            "group flex w-full items-center justify-between gap-2 border-0 border-b border-dashed border-tva-gold/12 bg-transparent py-1.5 pr-1 text-left font-mono text-xs hover:bg-tva-orange/8",
            selected && fileRowSelected,
            badgeCls,
          )}
          style={{ paddingLeft: depth * 12 + 6 }}
          role="button"
          tabIndex={0}
          onClick={() => onSelectPath?.(file.path)}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{fileDisplayName(file)}</span>
            </div>
            {selected ? (
              <div className="mt-0.5 break-all text-[10px] leading-snug text-tva-muted">{fileDisplayPath(file)}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.12em]">{mark}</span>
            {action ? (
              <button
                type="button"
                className="shrink-0 border border-tva-gold/35 bg-transparent px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-tva-gold enabled:hover:border-tva-orange enabled:hover:text-tva-gold-bright disabled:hover:border-tva-gold/35 disabled:hover:text-tva-gold"
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
    <div className={cn("h-full min-h-0 overflow-auto bg-[#16120e] text-tva-paper", className)}>
      {renderDir(dirTree, 0)}
    </div>
  );
}

