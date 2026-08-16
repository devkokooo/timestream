import type { Ref } from "react";
import { cn } from "../lib/cn";
import { btnStow, stamp, stampGold } from "../lib/ui";
import type { TimelineNode } from "../lib/types";
import { PersonName } from "./PersonName";

interface Props {
  node: TimelineNode;
  tipRef: Ref<HTMLDivElement>;
  body?: string | null;
  committer?: string | null;
  committerEmail?: string | null;
  filedAt?: number | null;
  isPr?: boolean;
  failed?: boolean;
  onExpand: () => void;
}

export function NexusTooltip({
  node,
  tipRef,
  body,
  committer,
  committerEmail,
  filedAt,
  isPr,
  failed,
  onExpand,
}: Props) {
  const branch = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD");
  const stampLabel = branch ? (node.column === 0 ? "NEXUS" : "VARIANT") : "EVENT";
  const refs = node.refs
    .filter((r) => r.kind !== "head")
    .map((r) => r.name)
    .join(" · ");

  return (
    <div
      ref={tipRef}
      className="nexus-tip pointer-events-none absolute top-0 left-0 z-10 w-[360px]"
      role="tooltip"
    >
      <div
        className="nexus-tip-card pointer-events-auto cursor-pointer px-3.5 py-3"
        title="Double-click to open the full dossier"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[13px] font-semibold tracking-[0.1em] text-tva-gold-bright">
            {node.shortId}
          </span>
          <span className="flex shrink-0 flex-wrap justify-end gap-1">
            {node.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : null}
            {failed ? <span className={stamp}>FAILED</span> : null}
            {isPr ? <span className={cn(stamp, stampGold)}>REQUEST</span> : null}
            <span className={cn(stamp, node.column === 0 && stampGold)}>{stampLabel}</span>
          </span>
        </div>
        <p className="mt-2 font-mono text-[13px] leading-snug text-tva-paper">{node.summary}</p>
        {body?.trim() ? (
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-tva-paper-dim">
            {body.trim()}
          </p>
        ) : null}
        {refs ? (
          <p className="mt-2 truncate font-mono text-[12px] tracking-[0.08em] text-tva-gold">{refs}</p>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="m-0 min-w-0 break-words font-mono text-[12px] leading-snug tracking-[0.04em] text-tva-muted">
            <PersonName
              name={committer?.trim() || node.author}
              email={committerEmail ?? node.email}
            />{" "}
            · {formatFiled(filedAt ?? node.timestamp)}
          </p>
          <button
            type="button"
            className={cn(btnStow, "shrink-0")}
            title="Open the full dossier"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            Expand
          </button>
        </div>
      </div>
      <span className="nexus-tip-caret" aria-hidden />
    </div>
  );
}

function formatFiled(timestamp: number): string {
  const iso = new Date(timestamp * 1000).toISOString();
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}
