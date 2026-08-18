import { useEffect, useMemo, useState, type ReactNode } from "react";
import { compareRange, getCommit, getFileDiff, getRangeFileDiff } from "../lib/api";
import { cn } from "../lib/cn";
import { parseCommitBody } from "../lib/commitTrailers";
import { actionMark, actionMarkTitle, actionTone, fileDisplayName, fileDisplayPath } from "../lib/diffView";
import { isTestFile } from "../lib/fileKind";
import { branchChoices, githubRefName, groupLedgerByDay, ledgerWhen, sameGitRef } from "../lib/prCompare";
import {
  actionColor,
  btn,
  emptyText,
  eyebrow,
  fieldInput,
  fileRowPad,
  fileRowSelected,
  TEST_FILE_HEX,
} from "../lib/ui";
import type { CommitDetail, DiffMode, FileChange, FileDiff, RangeCompare, Timeline } from "../lib/types";
import { DiffViewer } from "./DiffViewer";
import { PersonName } from "./PersonName";
import { FileKindIcon } from "./FileKindIcon";
import { TvaTerm } from "./TvaTerm";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

export type RequestDeskTab = "conversation" | "commits" | "files";

interface Props {
  repoPath: string | null;
  timeline: Timeline | null;
  currentBranch: string | null;
  sacredBranch: string | null;
  head: string;
  base: string;
  headSpec?: string;
  baseSpec?: string;
  extraBranches?: string[];
  onHead: (name: string) => void;
  onBase: (name: string) => void;
  children?: ReactNode;
  tab?: RequestDeskTab;
  onTab?: (tab: RequestDeskTab) => void;
  /** Tighter file list and chrome for marketing-site embeds. */
  compact?: boolean;
}

export function PrCompare({
  repoPath,
  timeline,
  currentBranch,
  sacredBranch,
  head,
  base,
  headSpec,
  baseSpec,
  extraBranches = [],
  onHead,
  onBase,
  children,
  tab: tabProp,
  onTab,
  compact = false,
}: Props) {
  const compareHead = headSpec || head;
  const compareBase = baseSpec || base;
  const [tabState, setTabState] = useState<RequestDeskTab>("conversation");
  const tab = tabProp ?? tabState;
  const setTab = (next: RequestDeskTab) => {
    onTab?.(next);
    if (tabProp === undefined) setTabState(next);
  };
  const [compare, setCompare] = useState<RangeCompare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");

  const branches = useMemo(
    () => branchChoices(timeline, [currentBranch, sacredBranch, head, base, ...extraBranches]),
    [timeline, currentBranch, sacredBranch, head, base, extraBranches],
  );
  const same = Boolean(head && base && sameGitRef(head, base));
  const selectedFile = compare?.files.find((file) => file.path === filePath) ?? null;

  useEffect(() => {
    if (!repoPath || !compareHead || !compareBase || same) {
      setCompare(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void compareRange(repoPath, compareBase, compareHead)
      .then((next) => {
        if (!cancelled) setCompare(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setCompare(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, compareHead, compareBase, same]);

  useEffect(() => {
    setFilePath(null);
    setDiff(null);
    setDiffError(null);
  }, [compareHead, compareBase]);

  useEffect(() => {
    if (!repoPath || !compareHead || !compareBase || !filePath || same) {
      setDiff(null);
      setDiffError(null);
      return;
    }
    let cancelled = false;
    void getRangeFileDiff(repoPath, compareBase, compareHead, filePath)
      .then((next) => {
        if (!cancelled) {
          setDiff(next);
          setDiffError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDiff(null);
          setDiffError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, compareHead, compareBase, filePath, same]);

  const commitCount = compare?.commits.length ?? 0;
  const fileCount = compare?.files.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-tva-gold/16 bg-[#1b1713] px-[18px] py-3">
        <p className={eyebrow}>Compare sequences</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <BranchSelect
            label="Into"
            noun="Base"
            value={base}
            options={branches}
            onChange={onBase}
          />
          <button
            type="button"
            className={cn(btn, "mb-px px-2")}
            title="Swap sequences"
            disabled={!head || !base}
            onClick={() => {
              onHead(base);
              onBase(head);
            }}
          >
            ←
          </button>
          <BranchSelect
            label="From"
            noun="Compare"
            value={head}
            options={branches}
            onChange={onHead}
          />
        </div>
        <p className="m-0 mt-2 text-[11px] text-tva-muted">
          {same
            ? "Pick two different sequences to compare."
            : loading
              ? "Reading variance…"
              : error
                ? error
                : compare
                  ? `${compare.ahead} event${compare.ahead === 1 ? "" : "s"} · ${fileCount} record${fileCount === 1 ? "" : "s"}${compare.behind ? ` · ${compare.behind} behind` : ""}`
                  : "Select sequences to inspect."}
        </p>
      </div>

      <div className="flex shrink-0 border-b border-tva-gold/16 bg-[#16120e]">
        <DeskTab
          active={tab === "conversation"}
          onClick={() => setTab("conversation")}
          flavor="Docket"
          noun="Conversation"
        />
        <DeskTab
          active={tab === "commits"}
          onClick={() => setTab("commits")}
          flavor={`Ledger · ${commitCount}`}
          noun="Commits"
        />
        <DeskTab
          active={tab === "files"}
          onClick={() => setTab("files")}
          flavor={`Variance · ${fileCount}`}
          noun="Files changed"
        />
      </div>

      {tab === "conversation" ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4 pb-[18px]">
          {children}
        </TvaScrollArea>
      ) : null}

      {tab === "commits" ? (
        <CommitLedger
          key={`${compareHead}:${compareBase}`}
          repoPath={repoPath}
          commits={compare?.commits ?? []}
          loading={loading}
          empty={same || !head || !base}
          diffMode={diffMode}
          onMode={setDiffMode}
          compact={compact}
        />
      ) : null}

      {tab === "files" ? (
        <div
          className={cn(
            "grid min-h-0 flex-1 overflow-hidden",
            compact ? "grid-cols-[280px_minmax(0,1fr)]" : "grid-cols-[220px_minmax(0,1fr)]",
          )}
        >
          <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
            <FileColumn
              files={compare?.files ?? []}
              selectedPath={filePath}
              onOpen={setFilePath}
              loading={loading}
              empty={same || !head || !base}
              compact={compact}
            />
          </aside>
          {filePath ? (
            <DiffViewer
              compact={compact}
              file={selectedFile}
              diff={diff}
              mode={diffMode}
              error={diffError}
              onMode={setDiffMode}
              onClose={() => {
                setFilePath(null);
                setDiff(null);
                setDiffError(null);
              }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e] px-6">
              <p className={eyebrow}>Variance record</p>
              <p className={cn(emptyText, "mt-2")}>Select a record from the file list.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BranchSelect({
  label,
  noun,
  value,
  options,
  onChange,
}: {
  label: string;
  noun: string;
  value: string;
  options: string[];
  onChange: (name: string) => void;
}) {
  const shown = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-tva-muted">
        {label} <span className="normal-case tracking-normal text-tva-muted/80">· {noun}</span>
      </span>
      <select
        className={cn(fieldInput, "py-1.5")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {value ? null : <option value="">Select sequence</option>}
        {shown.map((name) => (
          <option key={name} value={name}>
            {githubRefName(name) === name ? name : `${githubRefName(name)} (${name})`}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeskTab({
  active,
  onClick,
  flavor,
  noun,
}: {
  active: boolean;
  onClick: () => void;
  flavor: string;
  noun: string;
}) {
  return (
    <button
      type="button"
      className={`min-w-0 flex-1 border-0 px-1 py-2 ${active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"}`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
    </button>
  );
}

function CommitLedger({
  repoPath,
  commits,
  loading,
  empty,
  diffMode,
  onMode,
  compact = false,
}: {
  repoPath: string | null;
  commits: RangeCompare["commits"];
  loading: boolean;
  empty: boolean;
  diffMode: DiffMode;
  onMode: (mode: DiffMode) => void;
  compact?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const days = groupLedgerByDay(commits);
  const now = useNow();

  if (empty) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4">
        <p className={emptyText}>Pick two sequences to read the ledger.</p>
      </TvaScrollArea>
    );
  }
  if (loading && commits.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4">
        <p className={emptyText}>Reading events…</p>
      </TvaScrollArea>
    );
  }
  if (commits.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4">
        <p className={emptyText}>No exclusive events on the compare sequence.</p>
      </TvaScrollArea>
    );
  }
  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] py-3">
      {days.map((group) => (
        <section key={group.key} className="mb-3 last:mb-0">
          <h3 className="m-0 mb-2 font-mono text-[11px] text-tva-muted">{group.heading}</h3>
          {group.commits.map((commit) => (
            <CommitEventCard
              key={commit.id}
              commit={commit}
              repoPath={repoPath}
              open={openId === commit.id}
              onToggle={() => setOpenId((current) => (current === commit.id ? null : commit.id))}
              now={now}
              diffMode={diffMode}
              onMode={onMode}
              compact={compact}
            />
          ))}
        </section>
      ))}
    </TvaScrollArea>
  );
}

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function CommitEventCard({
  commit,
  repoPath,
  open,
  onToggle,
  now,
  diffMode,
  onMode,
  compact = false,
}: {
  commit: RangeCompare["commits"][number];
  repoPath: string | null;
  open: boolean;
  onToggle: () => void;
  now: number;
  diffMode: DiffMode;
  onMode: (mode: DiffMode) => void;
  compact?: boolean;
}) {
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const narrative = detail ? parseCommitBody(detail.body).narrative : "";
  const selectedFile = detail?.files.find((file) => file.path === filePath) ?? null;
  const when = ledgerWhen(commit.timestamp, now);

  useEffect(() => {
    if (!open || !repoPath) return;
    let cancelled = false;
    setError(null);
    void getCommit(repoPath, commit.id)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setFilePath((current) => current ?? next.files[0]?.path ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, repoPath, commit.id]);

  useEffect(() => {
    if (!open || !repoPath || !filePath) {
      setDiff(null);
      setDiffError(null);
      return;
    }
    let cancelled = false;
    void getFileDiff(repoPath, commit.id, filePath)
      .then((next) => {
        if (!cancelled) {
          setDiff(next);
          setDiffError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDiff(null);
          setDiffError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, repoPath, commit.id, filePath]);

  return (
    <div
      className={cn(
        "mb-2 overflow-hidden border border-tva-gold/18 bg-linear-to-b from-[#2a221a] to-[#1e1914]",
        open && "border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]",
      )}
    >
      <button
        type="button"
        className="w-full border-0 bg-transparent p-2.5 text-left hover:bg-tva-orange/8"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="flex justify-between gap-3 font-mono text-xs">
          <span className="text-tva-gold">{commit.shortId}</span>
          {when.label ? (
            <time
              dateTime={when.iso}
              title={when.absolute}
              className="shrink-0 cursor-help text-[10px] text-tva-muted underline decoration-dotted decoration-tva-gold/35 underline-offset-2"
            >
              {when.label}
            </time>
          ) : null}
        </div>
        <div className="mt-1.5 font-mono text-[11px] leading-snug text-tva-paper">
          <span className="mr-1.5 text-tva-gold" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          {commit.summary}
        </div>
        <div className="mt-1 text-[10px] tracking-[0.12em] text-tva-muted">
          <PersonName name={commit.author} email={commit.email} />
        </div>
      </button>
      {open ? (
        <div className="border-t border-tva-gold/16 px-2.5 pt-2.5 pb-2.5">
          {error ? <p className="m-0 mb-2 text-xs text-[#ff8a6a]">{error}</p> : null}
          {!detail && !error ? <p className={cn(emptyText, "mb-2")}>Reading event…</p> : null}
          {narrative ? (
            <p className="m-0 mb-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-tva-paper-dim">
              {narrative}
            </p>
          ) : null}
          {detail && detail.files.length === 0 ? (
            <p className={emptyText}>No records in this event.</p>
          ) : null}
          {detail && detail.files.length > 0 ? (
            <>
              <h4 className="m-0 mb-1 text-[10px] uppercase tracking-[0.14em] text-tva-gold">
                Records <span className="text-tva-muted">{detail.files.length}</span>
              </h4>
              <div className="mb-2">
                {detail.files.map((file) => (
                  <CommitFileRow
                    key={`${file.status}-${file.path}`}
                    file={file}
                    selected={filePath === file.path}
                    onOpen={() => setFilePath(file.path)}
                    compact={compact}
                  />
                ))}
              </div>
              {filePath ? (
                <div className="flex h-[min(36rem,55vh)] flex-col overflow-hidden border border-tva-gold/16">
                  <DiffViewer
                    compact={compact}
                    file={selectedFile}
                    diff={diff}
                    mode={diffMode}
                    error={diffError}
                    onMode={onMode}
                    onClose={() => {
                      setFilePath(null);
                      setDiff(null);
                      setDiffError(null);
                    }}
                  />
                </div>
              ) : (
                <p className={emptyText}>Select a record to read the variance.</p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CommitFileRow({
  file,
  selected,
  onOpen,
  compact = false,
}: {
  file: FileChange;
  selected: boolean;
  onOpen: () => void;
  compact?: boolean;
}) {
  const tone = actionTone(file.status);
  const mark = actionMark(file.status);
  const markTitle = actionMarkTitle(file.status);
  const test = isTestFile(file.path);
  return (
    <button
      type="button"
      title={fileDisplayPath(file)}
      aria-label={`${markTitle} · ${fileDisplayPath(file)}`}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center border-0 border-b border-dashed border-tva-gold/12 pr-1 text-left font-mono hover:bg-tva-orange/8",
        compact ? "min-h-11 gap-1.5 py-1.5 text-[11px] leading-tight" : "min-h-8 gap-2.5 py-1.5 text-xs",
        fileRowPad,
        actionColor[tone],
        selected && fileRowSelected,
      )}
      onClick={onOpen}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-inherit">
        <FileKindIcon path={file.path} color={test ? TEST_FILE_HEX : undefined} />
        <span className="min-w-0 overflow-hidden">
          <span
            className={cn(
              "block overflow-hidden text-ellipsis whitespace-nowrap",
              compact && "text-[11px]",
            )}
          >
            {fileDisplayName(file)}
          </span>
          {compact || selected ? (
            <span
              className={cn(
                "mt-0.5 block text-[10px] leading-snug text-tva-muted",
                compact
                  ? "overflow-hidden text-ellipsis whitespace-nowrap"
                  : "break-all",
              )}
            >
              {fileDisplayPath(file)}
            </span>
          ) : null}
        </span>
      </span>
      <span className="w-4 shrink-0 text-center text-[11px] font-semibold" title={markTitle}>
        {mark}
      </span>
    </button>
  );
}

function FileColumn({
  files,
  selectedPath,
  onOpen,
  loading,
  empty,
  compact = false,
}: {
  files: FileChange[];
  selectedPath: string | null;
  onOpen: (path: string) => void;
  loading: boolean;
  empty: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        compact ? "py-2.5 pr-2.5 pl-3" : "py-3 pr-2.5 pl-3.5",
      )}
    >
      <h3 className="mb-2 m-0 shrink-0 text-[11px] tracking-[0.14em] text-tva-gold">
        RECORDS <span className="text-tva-muted">{loading ? "…" : files.length}</span>
      </h3>
      {empty ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>Pick two sequences.</div>
        </TvaScrollArea>
      ) : loading && files.length === 0 ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>Reading records…</div>
        </TvaScrollArea>
      ) : files.length === 0 ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>No records changed.</div>
        </TvaScrollArea>
      ) : (
        <TvaVirtualList
          className="min-h-0 flex-1"
          axis="y"
          fill
          count={files.length}
          estimateSize={(index) =>
            compact ? 44 : files[index].path === selectedPath ? 56 : 40
          }
          getItemKey={(index) => files[index].path}
        >
          {(index) => {
            const item = files[index];
            const tone = actionTone(item.status);
            const mark = actionMark(item.status);
            const markTitle = actionMarkTitle(item.status);
            const selected = selectedPath === item.path;
            const test = isTestFile(item.path);
            return (
              <button
                type="button"
                title={fileDisplayPath(item)}
                aria-label={`${markTitle} · ${fileDisplayPath(item)}`}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center border-0 border-b border-dashed border-tva-gold/12 pr-2 text-left font-mono hover:bg-tva-orange/8",
                  compact ? "min-h-11 gap-1.5 py-1.5 text-[11px] leading-tight" : "min-h-10 gap-2.5 py-2 text-xs",
                  fileRowPad,
                  actionColor[tone],
                  selected && fileRowSelected,
                )}
                onClick={() => onOpen(item.path)}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-inherit">
                  <FileKindIcon path={item.path} color={test ? TEST_FILE_HEX : undefined} />
                  <span className="min-w-0 overflow-hidden">
                    <span
                      className={cn(
                        "block overflow-hidden text-ellipsis whitespace-nowrap",
                        compact && "text-[11px]",
                      )}
                    >
                      {fileDisplayName(item)}
                    </span>
                    {compact || selected ? (
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] leading-snug text-tva-muted",
                          compact
                            ? "overflow-hidden text-ellipsis whitespace-nowrap"
                            : "break-all",
                        )}
                      >
                        {fileDisplayPath(item)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="w-4 shrink-0 text-center text-[11px] font-semibold" title={markTitle}>
                  {mark}
                </span>
              </button>
            );
          }}
        </TvaVirtualList>
      )}
    </div>
  );
}
