import type { CommitDetail, TimelineNode } from "../lib/types";

interface Props {
  node: TimelineNode | null;
  detail: CommitDetail | null;
}

export function CaseFile({ node, detail }: Props) {
  if (!node) {
    return (
      <aside className="case-file">
        <h2 className="panel-title">CASE FILE</h2>
        <p className="empty">Select a nexus event on the Sacred Timeline.</p>
      </aside>
    );
  }

  const stamp = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD")
    ? node.column === 0
      ? "NEXUS"
      : "VARIANT"
    : "EVENT";

  return (
    <aside className="case-file">
      <div className="case-kicker">
        <h2 className="panel-title">CASE FILE</h2>
        <span className={`stamp ${node.column === 0 ? "gold" : ""}`}>{stamp}</span>
      </div>
      <div className="sha">{detail?.shortId ?? node.shortId}</div>
      <h3 className="summary">{detail?.summary ?? node.summary}</h3>
      {detail?.body ? <p className="meta">{detail.body}</p> : null}
      <p className="meta">
        {detail?.author ?? node.author}
        {detail?.email ? ` · ${detail.email}` : ""}
      </p>
      <p className="meta">
        {new Date((detail?.timestamp ?? node.timestamp) * 1000).toUTCString()}
      </p>
      <p className="meta">
        parents { (detail?.parents ?? node.parents).map((p) => p.slice(0, 7)).join(", ") || "none" }
      </p>
      <h2 className="panel-title" style={{ marginTop: 18 }}>
        AFFECTED FILES
      </h2>
      {(detail?.files ?? []).map((file) => (
        <div className="file-row" key={file.path}>
          <span>{file.path}</span>
          <span>{file.status}</span>
        </div>
      ))}
      {!detail ? <p className="empty">Retrieving holoprojector record…</p> : null}
    </aside>
  );
}
