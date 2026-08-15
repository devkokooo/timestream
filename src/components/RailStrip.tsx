import { cn } from "../lib/cn";

export function RailStrip({
  label,
  onExpand,
  side,
}: {
  label: string;
  onExpand: () => void;
  side: "start" | "end";
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-0 w-9 items-center justify-center bg-[#1b1713] text-[10px] tracking-[0.2em] text-tva-gold hover:bg-tva-orange/8 hover:text-tva-gold-bright",
        side === "start" ? "border-r border-tva-gold/16" : "border-l border-tva-gold/16",
      )}
      onClick={onExpand}
      aria-label={`Expand ${label}`}
    >
      <span className="rotate-180 [writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}
