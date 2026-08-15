import type { DiffHunk, DiffLine, DiffLineKind, FileAction, FileChange } from "./types";

export interface SplitCell {
  no: number | null;
  text: string;
  kind: DiffLineKind;
}

export interface SplitRow {
  left: SplitCell | null;
  right: SplitCell | null;
}

export function fileAction(status: string): FileAction {
  switch (status) {
    case "added":
    case "untracked":
      return "added";
    case "deleted":
      return "deleted";
    case "renamed":
    case "copied":
    case "moved":
      return "moved";
    default:
      return "modified";
  }
}

export function actionLabel(action: FileAction): string {
  switch (action) {
    case "added":
      return "ADDED";
    case "deleted":
      return "DELETED";
    case "moved":
      return "MOVED";
    default:
      return "MODIFIED";
  }
}

export type ActionMark = "M" | "R" | "D" | "A" | "U";

export function actionMark(status: string): ActionMark {
  switch (status) {
    case "added":
      return "A";
    case "untracked":
      return "U";
    case "deleted":
      return "D";
    case "renamed":
    case "copied":
    case "moved":
      return "R";
    default:
      return "M";
  }
}

export function actionMarkTitle(status: string): string {
  switch (actionMark(status)) {
    case "A":
      return "Added";
    case "U":
      return "Untracked";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    default:
      return "Modified";
  }
}

export function actionTone(status: string): string {
  return status === "untracked" ? "untracked" : fileAction(status);
}

export function fileBaseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const i = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return i === -1 ? trimmed : trimmed.slice(i + 1);
}

export function fileDisplayPath(file: Pick<FileChange, "path" | "oldPath" | "status">): string {
  if (fileAction(file.status) === "moved" && file.oldPath && file.oldPath !== file.path) {
    return `${file.oldPath} → ${file.path}`;
  }
  return file.path;
}

export function fileDisplayName(file: Pick<FileChange, "path" | "oldPath" | "status">): string {
  if (fileAction(file.status) === "moved" && file.oldPath && file.oldPath !== file.path) {
    return `${fileBaseName(file.oldPath)} → ${fileBaseName(file.path)}`;
  }
  return fileBaseName(file.path);
}

export function pairHunkLines(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "context" || line.kind === "meta") {
      rows.push({
        left: { no: line.oldNo, text: line.text, kind: line.kind },
        right: { no: line.newNo, text: line.text, kind: line.kind },
      });
      i += 1;
      continue;
    }

    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].kind === "deletion") {
      dels.push(lines[i]);
      i += 1;
    }
    while (i < lines.length && lines[i].kind === "addition") {
      adds.push(lines[i]);
      i += 1;
    }

    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k += 1) {
      const del = dels[k];
      const add = adds[k];
      rows.push({
        left: del ? { no: del.oldNo, text: del.text, kind: "deletion" } : null,
        right: add ? { no: add.newNo, text: add.text, kind: "addition" } : null,
      });
    }
  }
  return rows;
}

export function hunkKey(hunk: Pick<DiffHunk, "oldStart" | "newStart" | "header">): string {
  return `${hunk.oldStart}:${hunk.newStart}:${hunk.header}`;
}

export function hunkLineCounts(hunk: Pick<DiffHunk, "lines">): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const line of hunk.lines) {
    if (line.kind === "addition") added += 1;
    else if (line.kind === "deletion") deleted += 1;
  }
  return { added, deleted };
}
