import { useEffect, useMemo, useState } from "react";
import { listRemotes } from "@/remotes/api";
import { remoteNameError, remoteUrlError } from "@/remotes/remoteName";
import { cn } from "@/ui/cn";
import type { RemoteInfo } from "@/remotes/types";
import { btn, btnDanger, btnPrimary, btnStow, emptyText, errorText, fieldInput, stamp, stampGold } from "@/ui/ui";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { Bone, Skeleton } from "@/ui/TvaSkeleton";
import { TvaTerm } from "@/ui/TvaTerm";

interface Props {
  open: boolean;
  path: string | null;
  busy?: boolean;
  selectedRemote?: string | null;
  onClose: () => void;
  onSelect: (name: string) => void;
  onAdd: (name: string, url: string) => Promise<void>;
  onSetUrl: (name: string, url: string) => Promise<void>;
  onRename: (from: string, to: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
}

type Acting = "add" | "url" | "rename" | "delete" | null;
type RowMode = { kind: "rename" } | { kind: "url" } | { kind: "cull" } | null;

export function RemotesDesk({
  open,
  path,
  busy = false,
  selectedRemote = null,
  onClose,
  onSelect,
  onAdd,
  onSetUrl,
  onRename,
  onRemove,
}: Props) {
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [acting, setActing] = useState<Acting>(null);
  const [row, setRow] = useState<string | null>(null);
  const [rowMode, setRowMode] = useState<RowMode>(null);
  const [renameTo, setRenameTo] = useState("");
  const [urlTo, setUrlTo] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDraftName("");
      setDraftUrl("");
      setError(null);
      setActing(null);
      setRow(null);
      setRowMode(null);
      return;
    }
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listRemotes(path)
      .then((next) => {
        if (!cancelled) {
          setRemotes(next);
          setDraftName((current) => current || (next.length === 0 ? "origin" : ""));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (rowMode) {
        setRow(null);
        setRowMode(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rowMode, onClose]);

  const taken = useMemo(() => remotes.map((remote) => remote.name), [remotes]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return remotes;
    return remotes.filter(
      (remote) =>
        remote.name.toLowerCase().includes(q) || remote.url.toLowerCase().includes(q),
    );
  }, [remotes, query]);

  const locked = busy || acting !== null;
  const createNameError = draftName.trim() ? remoteNameError(draftName, taken) : null;
  const createUrlError = draftUrl.trim() ? remoteUrlError(draftUrl) : null;
  const addHint =
    remotes.some((remote) => remote.name === "origin") && !draftName.trim()
      ? "upstream"
      : remotes.length === 0
        ? "origin"
        : "";

  async function refresh() {
    if (!path) return;
    const next = await listRemotes(path);
    setRemotes(next);
  }

  async function run(kind: Acting, op: () => Promise<void>) {
    setError(null);
    setActing(kind);
    try {
      await op();
      await refresh().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-6 z-50 bg-black/45"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Remotes"
        className="absolute bottom-1 left-1 flex max-h-[min(72vh,560px)] w-[min(480px,calc(100vw-8px))] flex-col border border-tva-gold/30 bg-[#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-tva-gold/18 px-3 py-2.5">
          <h2 className="m-0">
            <TvaTerm flavor="Remotes" noun="Add, revise, or cull named remotes" />
          </h2>
          <button type="button" className={btnStow} onClick={onClose}>
            Stow
          </button>
        </header>
        <input
          className={`${fieldInput} rounded-none border-0 border-b border-tva-gold/20`}
          value={query}
          autoFocus
          placeholder="Filter remotes"
          onChange={(e) => setQuery(e.target.value)}
        />
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-2 py-2">
          {loading ? (
            <Skeleton label="Reading remotes">
              {[72, 54, 80].map((w, i) => (
                <div key={i} className="mb-2 border border-tva-gold/12 p-2.5">
                  <Bone className="bone-line" style={{ width: `${w}%` }} />
                </div>
              ))}
            </Skeleton>
          ) : visible.length === 0 ? (
            <p className={error && remotes.length === 0 ? cn(emptyText, "text-[#ff8a6a]") : emptyText}>
              {error && remotes.length === 0
                ? error
                : remotes.length === 0
                  ? "No remotes on this archive. File origin, upstream, or a mirror below."
                  : "No remotes match that filter."}
            </p>
          ) : (
            visible.map((remote) => (
              <RemoteRow
                key={remote.name}
                remote={remote}
                taken={taken}
                locked={locked}
                selected={selectedRemote === remote.name}
                mode={row === remote.name ? rowMode : null}
                renameTo={renameTo}
                urlTo={urlTo}
                onRenameTo={setRenameTo}
                onUrlTo={setUrlTo}
                onBeginRename={() => {
                  setRow(remote.name);
                  setRowMode({ kind: "rename" });
                  setRenameTo(remote.name);
                }}
                onBeginUrl={() => {
                  setRow(remote.name);
                  setRowMode({ kind: "url" });
                  setUrlTo(remote.url);
                }}
                onCancel={() => {
                  setRow(null);
                  setRowMode(null);
                }}
                onBeginCull={() => {
                  setRow(remote.name);
                  setRowMode({ kind: "cull" });
                }}
                onSelect={() => onSelect(remote.name)}
                onRename={() => {
                  const next = renameTo.trim();
                  const reason = remoteNameError(next, taken, { renaming: remote.name });
                  if (reason) {
                    setError(reason);
                    return;
                  }
                  void run("rename", async () => {
                    await onRename(remote.name, next);
                    setRow(null);
                    setRowMode(null);
                  });
                }}
                onSetUrl={() => {
                  const next = urlTo.trim();
                  const reason = remoteUrlError(next);
                  if (reason) {
                    setError(reason);
                    return;
                  }
                  void run("url", async () => {
                    await onSetUrl(remote.name, next);
                    setRow(null);
                    setRowMode(null);
                  });
                }}
                onCull={() =>
                  void run("delete", async () => {
                    await onRemove(remote.name);
                    setRow(null);
                    setRowMode(null);
                  })
                }
              />
            ))
          )}
        </TvaScrollArea>
        <form
          className="flex shrink-0 flex-col gap-2 border-t border-tva-gold/18 px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draftName.trim();
            const url = draftUrl.trim();
            const nameReason = remoteNameError(name, taken);
            const urlReason = remoteUrlError(url);
            if (nameReason) {
              setError(nameReason);
              return;
            }
            if (urlReason) {
              setError(urlReason);
              return;
            }
            void run("add", async () => {
              await onAdd(name, url);
              setDraftName("");
              setDraftUrl("");
            });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-tva-muted">Name</span>
            <input
              className={fieldInput}
              value={draftName}
              placeholder={addHint || "upstream"}
              disabled={locked}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-tva-muted">URL</span>
            <input
              className={fieldInput}
              value={draftUrl}
              placeholder="git@github.com:org/repo.git"
              disabled={locked}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
          </label>
          <p className="m-0 text-[10px] text-tva-muted">
            After origin, common extras are upstream (canonical source) and mirror.
          </p>
          <div className="flex justify-end">
            <button
              type="submit"
              className={btnPrimary}
              disabled={locked || !draftName.trim() || !draftUrl.trim() || Boolean(createNameError) || Boolean(createUrlError)}
            >
              File remote
            </button>
          </div>
        </form>
        {error && remotes.length > 0 ? <p className={cn(errorText, "mt-0 px-3 pb-2.5")}>{error}</p> : null}
      </div>
    </div>
  );
}

function transportStamp(transport: string): string {
  if (transport === "ssh") return "SSH";
  if (transport === "https") return "HTTPS";
  return "OTHER";
}

function RemoteRow({
  remote,
  taken,
  locked,
  selected,
  mode,
  renameTo,
  urlTo,
  onRenameTo,
  onUrlTo,
  onBeginRename,
  onBeginUrl,
  onCancel,
  onBeginCull,
  onSelect,
  onRename,
  onSetUrl,
  onCull,
}: {
  remote: RemoteInfo;
  taken: string[];
  locked: boolean;
  selected: boolean;
  mode: RowMode;
  renameTo: string;
  urlTo: string;
  onRenameTo: (value: string) => void;
  onUrlTo: (value: string) => void;
  onBeginRename: () => void;
  onBeginUrl: () => void;
  onCancel: () => void;
  onBeginCull: () => void;
  onSelect: () => void;
  onRename: () => void;
  onSetUrl: () => void;
  onCull: () => void;
}) {
  const renameReason = mode?.kind === "rename" ? remoteNameError(renameTo, taken, { renaming: remote.name }) : null;
  const urlReason = mode?.kind === "url" ? remoteUrlError(urlTo) : null;

  if (mode?.kind === "rename") {
    return (
      <form
        className="mb-2 flex flex-col gap-2 border border-tva-gold/30 bg-[#241910] p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!renameReason) onRename();
        }}
      >
        <input
          className={fieldInput}
          value={renameTo}
          autoFocus
          disabled={locked}
          onChange={(e) => onRenameTo(e.target.value)}
          aria-label={`Rename ${remote.name}`}
        />
        {renameReason ? <p className="m-0 text-[10px] text-[#ff8a6a]">{renameReason}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} disabled={locked} onClick={onCancel}>
            Hold
          </button>
          <button type="submit" className={btnPrimary} disabled={locked || Boolean(renameReason)}>
            Revise
          </button>
        </div>
      </form>
    );
  }

  if (mode?.kind === "url") {
    return (
      <form
        className="mb-2 flex flex-col gap-2 border border-tva-gold/30 bg-[#241910] p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!urlReason) onSetUrl();
        }}
      >
        <input
          className={fieldInput}
          value={urlTo}
          autoFocus
          disabled={locked}
          onChange={(e) => onUrlTo(e.target.value)}
          aria-label={`URL for ${remote.name}`}
        />
        {urlReason ? <p className="m-0 text-[10px] text-[#ff8a6a]">{urlReason}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} disabled={locked} onClick={onCancel}>
            Hold
          </button>
          <button type="submit" className={btnPrimary} disabled={locked || Boolean(urlReason)}>
            Revise URL
          </button>
        </div>
      </form>
    );
  }

  if (mode?.kind === "cull") {
    return (
      <div className="mb-2 flex flex-col gap-2 border border-tva-stamp/40 bg-[#2a1814] p-2.5">
        <p className="m-0 text-xs text-[#f3c2b8]">
          Cull remote '{remote.name}' from this archive? The remote host is not touched.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} disabled={locked} onClick={onCancel}>
            Hold
          </button>
          <button type="button" className={cn(btn, btnDanger)} disabled={locked} onClick={onCull}>
            Cull
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-2 flex w-full items-start gap-2 border border-tva-gold/18 p-2.5 text-left",
        selected
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910] border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-inherit enabled:hover:text-tva-gold-bright disabled:opacity-100"
        disabled={locked}
        onClick={onSelect}
        title={selected ? `Transmit via ${remote.name}` : `Use ${remote.name} for fetch and push`}
      >
        <div className="flex items-center justify-between gap-2 font-mono text-xs">
          <span className={cn("truncate", selected && "font-semibold text-tva-gold-bright")}>
            {remote.name}
          </span>
          <span className={cn(stamp, selected ? stampGold : "")}>{transportStamp(remote.transport)}</span>
        </div>
        <div className="mt-1 truncate font-mono text-[10px] tracking-[0.04em] text-tva-muted">
          {remote.url || "—"}
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button type="button" className={btnStow} disabled={locked} onClick={onBeginUrl}>
          URL
        </button>
        <button type="button" className={btnStow} disabled={locked} onClick={onBeginRename}>
          Revise
        </button>
        <button
          type="button"
          className={cn(btnStow, btnDanger)}
          disabled={locked}
          title={`Cull ${remote.name}`}
          onClick={onBeginCull}
        >
          Cull
        </button>
      </div>
    </div>
  );
}
