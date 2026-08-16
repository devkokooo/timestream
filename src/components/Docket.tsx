import { cn } from "../lib/cn";
import { btnStow } from "../lib/ui";
import type { CommitDetail, TimelineNode } from "../lib/types";
import { CaseFile } from "./CaseFile";
import { TvaTerm } from "./TvaTerm";

interface DocketProps {
  node: TimelineNode | null;
  detail: CommitDetail | null;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
  onSelectCommit: (id: string) => void;
  selectedSha: string | null;
  checksBySha: Record<string, string>;
  onStow: () => void;
}

export function Docket({
  node,
  detail,
  selectedPath,
  onOpenFile,
  onSelectCommit,
  selectedSha,
  checksBySha,
  onStow,
}: DocketProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="flex shrink-0 items-center border-b border-tva-gold/16">
        <div className="min-w-0 flex-1 px-3 py-2 text-tva-gold">
          <TvaTerm flavor="Case file" noun="Commit" className="items-center" />
        </div>
        <button type="button" className={cn(btnStow, "m-1")} onClick={onStow}>
          Stow
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden [&_aside]:border-0">
        <CaseFile
          node={node}
          detail={detail}
          selectedPath={selectedPath}
          onOpenFile={onOpenFile}
          onSelectCommit={onSelectCommit}
          checks={selectedSha ? checksBySha[selectedSha] : undefined}
        />
      </div>
    </aside>
  );
}
