import { cn } from "@/ui/cn";
import { hunkLineCounts } from "@/diff/diffView";
import type { DiffHunk } from "@/diff/types";

export function HunkHeader({
  hunk,
  reviewable,
  read,
  onToggleRead,
  sticky = false,
}: {
  hunk: DiffHunk;
  reviewable: boolean;
  read: boolean;
  onToggleRead?: () => void;
  sticky?: boolean;
}) {
  const counts = hunkLineCounts(hunk);
  return (
    <div
      className={cn(
        "diff-hunk-header flex w-full min-w-0 items-center gap-2 border border-tva-gold/14 bg-[#241c16] px-2.5 py-[5px]",
        read && "border-tva-gold/8 bg-[#1a1612]",
        sticky && "diff-sticky-header",
      )}
    >
      {reviewable && onToggleRead ? (
        <button
          type="button"
          className="min-w-0 flex-1 overflow-hidden border-0 bg-transparent p-0 text-left text-[11px] text-ellipsis whitespace-pre text-tva-gold hover:text-tva-gold-bright"
          aria-expanded={!read}
          aria-label={read ? "Expand hunk" : "Collapse hunk as read"}
          onClick={onToggleRead}
        >
          {hunk.header}
        </button>
      ) : (
        <div className="min-w-0 flex-1 overflow-hidden text-[11px] text-ellipsis whitespace-pre text-tva-gold">
          {hunk.header}
        </div>
      )}
      {counts.added > 0 || counts.deleted > 0 ? (
        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tracking-[0.04em]" aria-hidden>
          {counts.added > 0 ? <span className="text-[#c6d18d]">+{counts.added}</span> : null}
          {counts.added > 0 && counts.deleted > 0 ? " " : null}
          {counts.deleted > 0 ? <span className="text-[#ff8a6a]">−{counts.deleted}</span> : null}
        </span>
      ) : null}
      {reviewable && onToggleRead ? (
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-tva-gold">
          <input
            type="checkbox"
            checked={read}
            onChange={onToggleRead}
            aria-label={read ? "Mark hunk unread" : "Mark hunk as read"}
          />
          Read
        </label>
      ) : null}
    </div>
  );
}
