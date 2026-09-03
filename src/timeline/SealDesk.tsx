import { useEffect, useMemo, useState } from "react";
import { listTimelineTags } from "@/timeline/timelineView";
import { tagNameError } from "@/timeline/tagName";
import type { Timeline } from "@/timeline/types";
import { cn } from "@/ui/cn";
import { btnPrimary, btnStow, errorText, fieldInput, fieldLabel } from "@/ui/ui";
import { TvaTerm } from "@/ui/TvaTerm";

export interface SealTarget {
  sha: string;
  shortId: string;
  summary: string;
}

interface Props {
  open: boolean;
  target: SealTarget | null;
  timeline: Timeline | null;
  busy?: boolean;
  canPush: boolean;
  dispatchDefault: boolean;
  onDispatchDefault: (next: boolean) => void;
  onClose: () => void;
  onCreate: (name: string, sha: string, message: string | undefined, push: boolean) => Promise<void>;
}

export function SealDesk({
  open,
  target,
  timeline,
  busy = false,
  canPush,
  dispatchDefault,
  onDispatchDefault,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [dispatch, setDispatch] = useState(dispatchDefault);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = useMemo(
    () => (timeline ? listTimelineTags(timeline).map((t) => t.name) : []),
    [timeline],
  );

  useEffect(() => {
    if (!open) {
      setName("");
      setMessage("");
      setError(null);
      setActing(false);
      return;
    }
    setDispatch(dispatchDefault);
    setError(null);
  }, [open, dispatchDefault, target?.sha]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  const locked = busy || acting;
  const createError = name.trim() ? tagNameError(name, taken) : null;

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-6 z-50 bg-black/45"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="File a seal"
        className="absolute bottom-1 left-1 flex w-[min(420px,calc(100vw-8px))] flex-col border border-tva-gold/30 bg-[#1b1713] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-tva-gold/18 px-3 py-2.5">
          <h2 className="m-0">
            <TvaTerm flavor="File a seal" noun="Create a local tag on this nexus" />
          </h2>
          <button type="button" className={btnStow} onClick={onClose}>
            Stow
          </button>
        </header>

        <div className="border-b border-tva-gold/12 px-3 py-2.5 font-mono text-[11px] text-tva-paper-dim">
          <span className="text-tva-gold-bright">{target.shortId}</span>
          <span className="mx-1.5 text-tva-muted">·</span>
          <span className="line-clamp-2">{target.summary}</span>
        </div>

        <form
          className="flex flex-col gap-2.5 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const next = name.trim();
            const reason = tagNameError(next, taken);
            if (reason) {
              setError(reason);
              return;
            }
            setActing(true);
            setError(null);
            const annotation = message.trim() || undefined;
            const shouldPush = canPush && dispatch;
            void onCreate(next, target.sha, annotation, shouldPush)
              .then(() => onClose())
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err));
              })
              .finally(() => setActing(false));
          }}
        >
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Seal name</span>
            <input
              className={fieldInput}
              value={name}
              autoFocus
              placeholder="v1.0.0"
              disabled={locked}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Annotation (optional)</span>
            <textarea
              className={cn(fieldInput, "min-h-[64px] resize-y")}
              value={message}
              placeholder="Release notes for this seal"
              disabled={locked}
              rows={2}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {canPush ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-tva-paper-dim">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={dispatch}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDispatch(next);
                  onDispatchDefault(next);
                }}
              />
              <TvaTerm flavor="Dispatch to origin" noun="Also push this seal after filing" />
            </label>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              className={btnPrimary}
              disabled={locked || !name.trim() || Boolean(createError)}
            >
              File seal
            </button>
          </div>
          {error || createError ? (
            <p className={cn(errorText, "mt-0")}>{error ?? createError}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
