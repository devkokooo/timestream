import { useState } from "react";
import type { FileChange, StatusPayload } from "../lib/types";

interface Props {
  status: StatusPayload | null;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onCommit: (message: string) => Promise<void>;
  busy: boolean;
}

export function AnomalyDock({ status, onStage, onUnstage, onCommit, busy }: Props) {
  const [message, setMessage] = useState("");
  const staged = status?.staged ?? [];
  const unstaged = status?.unstaged ?? [];
  const untracked = status?.untracked ?? [];
  const count = staged.length + unstaged.length + untracked.length;

  return (
    <footer className="anomaly-dock">
      <h2 className="panel-title">
        TEMPORAL ANOMALIES {count ? `· ${count} DETECTED` : "· SEQUENCE STABLE"}
      </h2>
      <div className="anomaly-grid">
        <Column title="FILED (STAGED)" items={staged} action="unfile" onClick={onUnstage} />
        <Column title="UNFILED" items={unstaged} action="file" onClick={onStage} />
        <Column title="UNTRACKED VARIANTS" items={untracked} action="file" onClick={onStage} />
        <div className="commit-box">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Case note for this filing…"
          />
          <button
            className="btn primary"
            disabled={busy || !staged.length || !message.trim()}
            onClick={async () => {
              await onCommit(message);
              setMessage("");
            }}
          >
            File variant
          </button>
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
}: {
  title: string;
  items: FileChange[];
  action: "file" | "unfile";
  onClick: (path: string) => void;
}) {
  return (
    <div className="anomaly-col">
      <h3>{title}</h3>
      {items.length === 0 ? <div className="empty">None</div> : null}
      {items.map((item) => (
        <button
          key={`${action}-${item.path}`}
          className="anomaly-item"
          onClick={() => onClick(item.path)}
        >
          <span>{item.path}</span>
          <span>{item.status}</span>
        </button>
      ))}
    </div>
  );
}
