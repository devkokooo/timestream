import { cn } from "../lib/cn";
import { btnStow } from "../lib/ui";
import type { AheadBehind, RailTab, Timeline } from "../lib/types";
import { TagsRail } from "./TagsRail";
import { TvaTerm } from "./TvaTerm";
import { VariantRail } from "./VariantRail";

interface Props {
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  timeline: Timeline;
  selectedId: string | null;
  onSelectTag: (id: string) => void;
  onCheckout: (name: string) => void;
  onStow: () => void;
  busy: boolean;
  prByBranch?: Record<string, number>;
  aheadBehind?: AheadBehind | null;
}

export function LeftRail({
  tab,
  onTab,
  timeline,
  selectedId,
  onSelectTag,
  onCheckout,
  onStow,
  busy,
  prByBranch,
  aheadBehind,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="flex shrink-0 border-b border-tva-gold/16">
        <div className="flex min-w-0 flex-1">
          <TabBtn active={tab === "variants"} onClick={() => onTab("variants")} flavor="Variants" noun="Branches" />
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
      ) : (
        <TagsRail timeline={timeline} selectedId={selectedId} onSelect={onSelectTag} />
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
      className={`min-w-0 flex-1 border-0 px-1 py-2 ${active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"}`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
    </button>
  );
}
