interface Props {
  path: string;
  onPath: (value: string) => void;
  onBrowse: () => void;
  onOpen: () => void;
  error: string | null;
}

export function WelcomeGate({ path, onPath, onBrowse, onOpen, error }: Props) {
  return (
    <div className="welcome">
      <section className="intake">
        <p className="eyebrow">For all time. Always.</p>
        <h1>TIMESTREAM</h1>
        <p className="eyebrow">Chronomonitoring Division</p>
        <p>
          Submit a local working tree. The Sacred Timeline will be reconstructed
          from first-parent history; other branches are filed as variants.
        </p>
        <div className="path-row">
          <input
            value={path}
            onChange={(e) => onPath(e.target.value)}
            placeholder="C:/path/to/repository"
            onKeyDown={(e) => {
              if (e.key === "Enter") onOpen();
            }}
          />
          <button className="btn" onClick={onBrowse}>
            Browse
          </button>
          <button className="btn primary" onClick={onOpen}>
            Review
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
      </section>
    </div>
  );
}
