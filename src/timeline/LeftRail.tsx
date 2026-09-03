import { cn } from "@/ui/cn";
import { btnStow } from "@/ui/ui";
import type { AheadBehind } from "@/remotes/types";
import type { RailTab, Timeline, TimelineNode } from "@/timeline/types";
import { HistoryRail } from "@/timeline/HistoryRail";
import { TagsRail } from "@/timeline/TagsRail";
import { TvaTerm } from "@/ui/TvaTerm";
import { VariantRail } from "@/timeline/VariantRail";

interface Props {
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  timeline: Timeline;
  selectedId: string | null;
  onSelectTag: (id: string) => void;
  onSelectCommit?: (id: string) => void;
  onCheckout: (name: string) => void;
  onStow: () => void;
  busy: boolean;
  prByBranch?: Record<string, number>;
  aheadBehind?: AheadBehind | null;
  branch?: string | null;
  canPush?: boolean;
  onSealNexus?: (node: TimelineNode) => void;
  onOpenDossier?: (id: string) => void;
  onCullTag?: (name: string) => void;
  onCullLocal?: (name: string) => void;
  onFileSeal?: () => void;
  onPushTag?: (name: string) => void;
  onCullRemoteTag?: (name: string) => void;
  canFileSeal?: boolean;
}

export function LeftRail({
  tab,
  onTab,
  timeline,
  selectedId,
  onSelectTag,
  onSelectCommit,
  onCheckout,
  onStow,
  busy,
  prByBranch,
  aheadBehind,
  branch,
  canPush = false,
  onSealNexus,
  onOpenDossier,
  onCullTag,
  onCullLocal,
  onFileSeal,
  onPushTag,
  onCullRemoteTag,
  canFileSeal = false,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="flex shrink-0 border-b border-tva-gold/16">
        <div className="flex min-w-0 flex-1">
          <TabBtn active={tab === "variants"} onClick={() => onTab("variants")} flavor="Variants" noun="Branches" />
          <TabBtn active={tab === "history"} onClick={() => onTab("history")} flavor="Ledger" noun="History" />
          <TabBtn active={tab === "tags"} onClick={() => onTab("tags")} flavor="Seals" noun="Tags" />
        </div>
        <button type="button" className={cn(btnStow, "m-1")} onClick={onStow}>
          Stow
        </button>
      </div>
      {tab === "variants" ? (
        <VariantRail
          timeline={timeline}
          onCheckout={onCheckout}
          busy={busy}
          prByBranch={prByBranch}
          aheadBehind={aheadBehind}
        />
      ) : tab === "history" ? (
        <HistoryRail
          timeline={timeline}
          selectedId={selectedId}
          onSelect={onSelectCommit ?? onSelectTag}
          branch={branch}
          onSealNexus={onSealNexus}
          onOpenDossier={onOpenDossier ?? onSelectTag}
          onCullTag={onCullTag}
        />
      ) : (
        <TagsRail
          timeline={timeline}
          selectedId={selectedId}
          onSelect={onSelectTag}
          canFileSeal={canFileSeal}
          canPush={canPush}
          busy={busy}
          onFileSeal={onFileSeal}
          onCullLocal={onCullLocal ?? onCullTag}
          onPush={onPushTag}
          onCullRemote={onCullRemoteTag}
        />
      )}
    </aside>
  );
}

function TabBtn({
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
      className={`min-w-0 flex-1 border-0 px-1 py-2 text-[11px] ${active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"}`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
    </button>
  );
}
