import { useState } from "react";
import { fileAction } from "../lib/diffView";
import type { FileChange, StatusPayload } from "../lib/types";
import { AnomalyColumnSkeleton } from "./TvaSkeleton";

interface Props {
  status: StatusPayload | null;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onCommit: (message: string) => Promise<void>;
  busy: boolean;
}

export function AnomalyDock({ status, onStage, onUnstage, onCommit, busy }: Props) {
  const [message, setMessage] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const loading = status == null;
  const staged = status?.staged ?? [];
  const unstaged = status?.unstaged ?? [];
  const untracked = status?.untracked ?? [];
  const count = staged.length + unstaged.length + untracked.length;

  return (
    <footer className={`anomaly-dock${collapsed ? " collapsed" : ""}`}>
      <button
        type="button"
        className="anomaly-toggle"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <h2 className="panel-title">
          TEMPORAL ANOMALIES{" "}
          {loading
            ? "· SCANNING"
            : count
              ? `· ${count} DETECTED`
              : "· SEQUENCE STABLE"}
        </h2>
        <span className="anomaly-chevron" aria-hidden>
          {collapsed ? "▲" : "▼"}
        </span>
      </button>
      <div className="anomaly-panel" aria-hidden={collapsed}>
        <div className="anomaly-grid">
          <Column
            title="FILED (STAGED)"
            items={staged}
            action="unfile"
            onClick={onUnstage}
            loading={loading}
          />
          <Column
            title="UNFILED"
            items={unstaged}
            action="file"
            onClick={onStage}
            loading={loading}
          />
          <Column
            title="UNTRACKED VARIANTS"
            items={untracked}
            action="file"
            onClick={onStage}
            loading={loading}
          />
          <div className="commit-box">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Case note for this filing…"
              tabIndex={collapsed ? -1 : 0}
            />
            <button
              className="btn primary"
              disabled={busy || !staged.length || !message.trim()}
              tabIndex={collapsed ? -1 : 0}
              onClick={async () => {
                await onCommit(message);
                setMessage("");
              }}
            >
              File variant
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Column({
  title,
  items,
  action,
  onClick,
  loading,
}: {
  title: string;
  items: FileChange[];
  action: "file" | "unfile";
  onClick: (path: string) => void;
  loading: boolean;
}) {
  return (
    <div className="anomaly-col">
      <h3>{title}</h3>
      {loading ? <AnomalyColumnSkeleton /> : null}
      {!loading && items.length === 0 ? <div className="empty">—</div> : null}
      {!loading
        ? items.map((item) => (
            <button
              key={`${action}-${item.path}`}
              className={`anomaly-item action-${fileAction(item.status)}`}
              onClick={() => onClick(item.path)}
            >
              <span>{item.path}</span>
              <span>{item.status}</span>
            </button>
          ))
        : null}
    </div>
  );
}
