import { useEffect, useState } from "react";
import { cn } from "@/ui/cn";
import { docketAction, type DocketEntry } from "@/github/pulls/prDocket";
import { formatLocalDateTime, formatRelativeTime } from "@/ui/relativeTime";
import { emptyText, stamp, stampGold } from "@/ui/ui";
import { PersonName } from "@/auth/PersonName";

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function DocketFeed({ entries }: { entries: DocketEntry[] }) {
  const now = useNow();
  return (
    <>
      {entries.map((entry) => (
        <DocketItem key={entry.id} entry={entry} now={now} />
      ))}
    </>
  );
}

function DocketWhen({ at, now }: { at: string; now: number }) {
  const relative = formatRelativeTime(at, now);
  const absolute = formatLocalDateTime(at);
  if (!relative) return null;
  return (
    <time
      dateTime={at}
      title={absolute}
      className="cursor-help text-tva-muted underline decoration-dotted decoration-tva-gold/35 underline-offset-2"
    >
      {relative}
    </time>
  );
}

function DocketItem({ entry, now }: { entry: DocketEntry; now: number }) {
  const mark =
    entry.kind === "opened"
      ? "REQUEST"
      : entry.kind === "incident"
        ? "INCIDENT"
        : entry.kind === "commits"
          ? "LEDGER"
          : entry.kind === "review" && entry.state === "APPROVED"
            ? "CLEAR"
            : entry.kind === "review" && entry.state === "CHANGES_REQUESTED"
              ? "FLAG"
              : entry.kind === "review"
                ? "NOTE"
                : entry.kind === "reviewComment"
                  ? "LINE"
                  : "NOTE";
  const gold = mark === "CLEAR" || mark === "REQUEST" || mark === "INCIDENT";
  const action = docketAction(entry);

  return (
    <div className="mb-2 border border-tva-gold/16 bg-[#1b1713] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 font-mono text-[11px] text-tva-paper">
          <PersonName name={entry.user} login={entry.user} email={entry.email} /> {action}{" "}
          <DocketWhen at={entry.at} now={now} />
          {entry.kind === "reviewComment" && entry.path
            ? ` · ${entry.path}${entry.line != null ? `:${entry.line}` : ""}`
            : ""}
        </p>
        <span className={cn(stamp, gold && stampGold)}>{mark}</span>
      </div>
      {(entry.kind === "opened" || entry.kind === "incident") && entry.summary ? (
        <p className="m-0 mt-1.5 text-[12px] text-tva-paper">{entry.summary}</p>
      ) : null}
      {entry.kind === "commits"
        ? (entry.commits ?? []).map((commit) => (
            <div key={`${commit.shortId}-${commit.at}`} className="mt-1 flex items-baseline gap-2 font-mono text-[11px]">
              <span className="shrink-0 text-tva-gold">{commit.shortId}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-tva-paper-dim">
                {commit.summary}
              </span>
            </div>
          ))
        : null}
      {entry.body ? (
        <p className="m-0 mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-tva-paper-dim">
          {entry.body}
        </p>
      ) : entry.kind === "opened" || entry.kind === "incident" ? (
        <p className={cn(emptyText, "mt-1.5")}>No description.</p>
      ) : null}
    </div>
  );
}
