import type { DiffHunk, DiffLine, DiffLineKind, DiffMode, FileAction, FileChange } from "./types";

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

export const DIFF_HEADER_HEIGHT = 36;
export const DIFF_LINE_HEIGHT = 19;
export const DIFF_CHAR_PX = 7.2;
export const DIFF_INLINE_GUTTER_PX = 106;
export const DIFF_SPLIT_GUTTER_PX = 44;

export type DiffViewRow =
  | { type: "header"; hunkIndex: number; key: string }
  | { type: "inline"; hunkIndex: number; lineIndex: number; line: DiffLine }
  | { type: "split"; hunkIndex: number; rowIndex: number; left: SplitCell | null; right: SplitCell | null };

export function flattenDiffRows(
  hunks: DiffHunk[],
  mode: DiffMode,
  collapsedKeys: ReadonlySet<string>,
): DiffViewRow[] {
  const rows: DiffViewRow[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    const key = hunkKey(hunk);
    rows.push({ type: "header", hunkIndex, key });
    if (collapsedKeys.has(key)) return;
    if (mode === "split") {
      pairHunkLines(hunk.lines).forEach((pair, rowIndex) => {
        rows.push({
          type: "split",
          hunkIndex,
          rowIndex,
          left: pair.left,
          right: pair.right,
        });
      });
      return;
    }
    hunk.lines.forEach((line, lineIndex) => {
      rows.push({ type: "inline", hunkIndex, lineIndex, line });
    });
  });
  return rows;
}

export function estimateDiffRowSize(row: DiffViewRow): number {
  return row.type === "header" ? DIFF_HEADER_HEIGHT : DIFF_LINE_HEIGHT;
}

export function diffContentMinWidth(hunks: DiffHunk[], mode: DiffMode): number {
  let maxChars = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.text.length > maxChars) maxChars = line.text.length;
    }
  }
  const code = Math.ceil(maxChars * DIFF_CHAR_PX) + 24;
  if (mode === "split") return Math.max(240, DIFF_SPLIT_GUTTER_PX + code);
  return Math.max(320, DIFF_INLINE_GUTTER_PX + code);
}

export interface SplitHeaderOverlay {
  key: string;
  hunkIndex: number;
  top: number;
  sticky: boolean;
}

/** Positions one connected hunk header over split panes, sticky while its lines are in view. */
export function splitHeaderOverlay(
  rows: DiffViewRow[],
  scrollTop: number,
  viewportH: number,
): SplitHeaderOverlay[] {
  const starts: Array<{ key: string; hunkIndex: number; y: number }> = [];
  let y = 0;
  for (const row of rows) {
    if (row.type === "header") starts.push({ key: row.key, hunkIndex: row.hunkIndex, y });
    y += estimateDiffRowSize(row);
  }

  const viewH = viewportH || 1;
  const out: SplitHeaderOverlay[] = [];
  let sticky: { key: string; hunkIndex: number; y: number; nextY: number } | null = null;

  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const nextY = i + 1 < starts.length ? starts[i + 1].y : Number.POSITIVE_INFINITY;
    if (cur.y <= scrollTop && nextY > scrollTop) {
      sticky = { ...cur, nextY };
    }
    const top = cur.y - scrollTop;
    if (top < viewH && top + DIFF_HEADER_HEIGHT > 0) {
      out.push({ key: cur.key, hunkIndex: cur.hunkIndex, top, sticky: false });
    }
  }

  if (sticky) {
    const natural = sticky.y - scrollTop;
    const pushed = sticky.nextY - scrollTop - DIFF_HEADER_HEIGHT;
    const top = Math.min(Math.max(natural, 0), pushed);
    const existing = out.findIndex((h) => h.key === sticky.key);
    const next: SplitHeaderOverlay = {
      key: sticky.key,
      hunkIndex: sticky.hunkIndex,
      top,
      sticky: natural < 0,
    };
    if (existing >= 0) out[existing] = next;
    else out.unshift(next);
  }

  return out;
}
