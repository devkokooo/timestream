import { useEffect, useMemo, useState } from "react";
import { getBranches } from "../lib/api";
import { branchNameError } from "../lib/branchName";
import { cn } from "../lib/cn";
import type { BranchInfo } from "../lib/types";
import { btn, btnDanger, btnPrimary, btnStow, emptyText, errorText, fieldInput, stamp, stampGold } from "../lib/ui";
import { TvaScrollArea } from "./TvaScrollArea";
import { Bone, Skeleton } from "./TvaSkeleton";
import { TvaTerm } from "./TvaTerm";

interface Props {
  open: boolean;
  path: string | null;
  busy?: boolean;
  onClose: () => void;
  onSwitch: (name: string) => Promise<void>;
  onCreate: (name: string, checkout: boolean) => Promise<void>;
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

type Acting = "create" | "switch" | "rename" | "delete" | null;

export function BranchPicker({
  open,
  path,
  busy = false,
  onClose,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [checkout, setCheckout] = useState(true);
  const [acting, setActing] = useState<Acting>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDraft("");
      setCheckout(true);
      setError(null);
      setActing(null);
      setRenaming(null);
      setConfirming(null);
      return;
    }
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getBranches(path)
      .then((next) => {
        if (!cancelled) setBranches(next);
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
      if (renaming || confirming) {
        setRenaming(null);
        setConfirming(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, renaming, confirming, onClose]);

  const taken = useMemo(() => branches.map((b) => b.name), [branches]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, query]);

  const locked = busy || acting !== null;
  const createError = draft.trim() ? branchNameError(draft, taken) : null;

  async function refresh() {
    if (!path) return;
    const next = await getBranches(path);
    setBranches(next);
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
        aria-label="Local sequences"
        className="absolute bottom-1 left-1 flex max-h-[min(72vh,520px)] w-[min(440px,calc(100vw-8px))] flex-col border border-tva-gold/30 bg-[#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-tva-gold/18 px-3 py-2.5">
          <h2 className="m-0">
            <TvaTerm flavor="Sequences" noun="Create, rename, or cull local branches" />
          </h2>
          <button type="button" className={btnStow} onClick={onClose}>
            Stow
          </button>
        </header>
        <input
          className={`${fieldInput} rounded-none border-0 border-b border-tva-gold/20`}
          value={query}
          autoFocus
          placeholder="Filter sequences"
          onChange={(e) => setQuery(e.target.value)}
        />
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-2 py-2">
          {loading ? (
            <Skeleton label="Reading sequences">
              {[72, 54, 80].map((w, i) => (
                <div key={i} className="mb-2 border border-tva-gold/12 p-2.5">
                  <Bone className="bone-line" style={{ width: `${w}%` }} />
                </div>
              ))}
            </Skeleton>
          ) : visible.length === 0 ? (
            <p className={error && branches.length === 0 ? cn(emptyText, "text-[#ff8a6a]") : emptyText}>
              {error && branches.length === 0
                ? error
                : branches.length === 0
                  ? "No local sequences on this archive."
                  : "No sequences match that filter."}
            </p>
          ) : (
            visible.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                taken={taken}
                locked={locked}
                renaming={renaming === branch.name}
                renameTo={renameTo}
                confirming={confirming === branch.name}
                onRenameTo={setRenameTo}
                onBeginRename={() => {
                  setConfirming(null);
                  setRenaming(branch.name);
                  setRenameTo(branch.name);
                }}
                onCancel={() => {
                  setRenaming(null);
                  setConfirming(null);
                }}
                onBeginCull={() => {
                  setRenaming(null);
                  setConfirming(branch.name);
                }}
                onSwitch={() => void run("switch", () => onSwitch(branch.name))}
                onRename={() => {
                  const next = renameTo.trim();
                  const reason = branchNameError(next, taken, { renaming: branch.name });
                  if (reason) {
                    setError(reason);
                    return;
                  }
                  void run("rename", async () => {
                    await onRename(branch.name, next);
                    setRenaming(null);
                  });
                }}
                onCull={() =>
                  void run("delete", async () => {
                    await onDelete(branch.name);
                    setConfirming(null);
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
            const name = draft.trim();
            const reason = branchNameError(name, taken);
            if (reason) {
              setError(reason);
              return;
            }
            void run("create", async () => {
              await onCreate(name, checkout);
              setDraft("");
            });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-tva-muted">New variant</span>
            <input
              className={fieldInput}
              value={draft}
              placeholder="feature/name"
              disabled={locked}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checkout}
              disabled={locked}
              onChange={(e) => setCheckout(e.target.checked)}
            />
            <TvaTerm flavor="Switch after filing" noun="Check out the new sequence" />
          </label>
          <div className="flex justify-end">
            <button type="submit" className={btnPrimary} disabled={locked || !draft.trim() || Boolean(createError)}>
              File variant
            </button>
          </div>
        </form>
        {error && branches.length > 0 ? <p className={cn(errorText, "mt-0 px-3 pb-2.5")}>{error}</p> : null}
      </div>
    </div>
  );
}

function BranchRow({
  branch,
  taken,
  locked,
  renaming,
  renameTo,
  confirming,
  onRenameTo,
  onBeginRename,
  onCancel,
  onBeginCull,
  onSwitch,
  onRename,
  onCull,
}: {
  branch: BranchInfo;
  taken: string[];
  locked: boolean;
  renaming: boolean;
  renameTo: string;
  confirming: boolean;
  onRenameTo: (value: string) => void;
  onBeginRename: () => void;
  onCancel: () => void;
  onBeginCull: () => void;
  onSwitch: () => void;
  onRename: () => void;
  onCull: () => void;
}) {
  const renameReason = renaming ? branchNameError(renameTo, taken, { renaming: branch.name }) : null;

  if (renaming) {
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
          aria-label={`Rename ${branch.name}`}
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

  if (confirming) {
    return (
      <div className="mb-2 flex flex-col gap-2 border border-tva-stamp/40 bg-[#2a1814] p-2.5">
        <p className="m-0 text-xs text-[#f3c2b8]">Cull local sequence '{branch.name}'? Origin is not touched.</p>
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
        branch.isHead
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910] border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-inherit enabled:hover:text-tva-gold-bright disabled:opacity-100"
        disabled={locked || branch.isHead}
        onClick={onSwitch}
        title={branch.isHead ? "Current sequence" : `Switch to ${branch.name}`}
      >
        <div className="flex items-center justify-between gap-2 font-mono text-xs">
          <span className={cn("truncate", branch.isHead && "font-semibold text-tva-gold-bright")}>{branch.name}</span>
          {branch.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : <span className={stamp}>VARIANT</span>}
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-tva-muted">
          {branch.tip.slice(0, 7) || "—"}
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button type="button" className={btnStow} disabled={locked} onClick={onBeginRename}>
          Revise
        </button>
        <button
          type="button"
          className={cn(btnStow, btnDanger)}
          disabled={locked || branch.isHead}
          title={branch.isHead ? "Switch away before culling the active sequence" : `Cull ${branch.name}`}
          onClick={onBeginCull}
        >
          Cull
        </button>
      </div>
    </div>
  );
}
