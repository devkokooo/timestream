import type { DiffLine, DiffLineKind, FileAction, FileChange } from "./types";

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

export function fileDisplayPath(file: Pick<FileChange, "path" | "oldPath" | "status">): string {
  if (fileAction(file.status) === "moved" && file.oldPath && file.oldPath !== file.path) {
    return `${file.oldPath} → ${file.path}`;
  }
  return file.path;
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
