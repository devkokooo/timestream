import { actionLabel, fileAction, fileDisplayPath } from "../lib/diffView";
import type { CommitDetail, FileChange, TimelineNode } from "../lib/types";
import { CaseFileDetailSkeleton } from "./TvaSkeleton";
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  node: TimelineNode | null;
  detail: CommitDetail | null;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
}

export function CaseFile({ node, detail, selectedPath, onOpenFile }: Props) {
  if (!node) {
    return (
      <aside className="case-file">
        <TvaScrollArea className="case-file-scroll" axis="y" fill viewportClassName="case-file-pad">
          <h2 className="panel-title">CASE FILE</h2>
          <p className="empty">Select a nexus event on the Sacred Timeline.</p>
        </TvaScrollArea>
      </aside>
    );
  }

  const loading = !detail || detail.id !== node.id;
  const stamp = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD")
    ? node.column === 0
      ? "NEXUS"
      : "VARIANT"
    : "EVENT";

  return (
    <aside className="case-file">
      <TvaScrollArea className="case-file-scroll" axis="y" fill viewportClassName="case-file-pad">
        <div className="case-kicker">
          <h2 className="panel-title">CASE FILE</h2>
          <span className={`stamp ${node.column === 0 ? "gold" : ""}`}>{stamp}</span>
        </div>
        <div className="sha">{detail && !loading ? detail.shortId : node.shortId}</div>
        <h3 className="summary">{detail && !loading ? detail.summary : node.summary}</h3>
        {!loading && detail?.body ? <p className="meta">{detail.body}</p> : null}
        <p className="meta">
          {detail && !loading ? detail.author : node.author}
          {detail && !loading && detail.email ? ` · ${detail.email}` : ""}
        </p>
        <p className="meta">
          {new Date((detail && !loading ? detail.timestamp : node.timestamp) * 1000).toUTCString()}
        </p>
        <p className="meta">
          parents{" "}
          {(detail && !loading ? detail.parents : node.parents)
            .map((p) => p.slice(0, 7))
            .join(", ") || "none"}
        </p>
        <h2 className="panel-title" style={{ marginTop: 18 }}>
          AFFECTED FILES
        </h2>
        {loading ? (
          <CaseFileDetailSkeleton />
        ) : (
          (detail?.files ?? []).map((file) => (
            <FileRow
              key={`${file.status}-${file.path}`}
              file={file}
              selected={selectedPath === file.path}
              onOpen={() => onOpenFile(file.path)}
            />
          ))
        )}
      </TvaScrollArea>
    </aside>
  );
}

function FileRow({
  file,
  selected,
  onOpen,
}: {
  file: FileChange;
  selected: boolean;
  onOpen: () => void;
}) {
  const action = fileAction(file.status);
  return (
    <button
      type="button"
      className={`file-row action-${action}${selected ? " selected" : ""}`}
      onClick={onOpen}
    >
      <span className="file-path">{fileDisplayPath(file)}</span>
      <span className="file-action">{actionLabel(action)}</span>
    </button>
  );
}
