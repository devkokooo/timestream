export const btn =
  "border border-tva-gold/35 bg-[#2d241c] px-3 py-[7px] text-[11px] uppercase tracking-[0.08em] text-tva-paper hover:border-tva-orange hover:text-tva-gold-bright disabled:opacity-50";

export const btnPrimary =
  "border border-[#ffb347] bg-tva-orange-hot px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.08em] text-tva-ink hover:border-[#ffc56a] hover:bg-[#ffb347] hover:text-tva-ink disabled:border-tva-gold/20 disabled:bg-[#2d241c] disabled:text-tva-muted disabled:hover:border-tva-gold/20 disabled:hover:bg-[#2d241c] disabled:hover:text-tva-muted";

export const btnDanger = "border-tva-stamp text-[#f3c2b8]";

export const btnStow =
  "shrink-0 border border-tva-gold/35 bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold hover:border-tva-orange hover:text-tva-gold-bright";

export const panelTitle =
  "m-0 font-display text-[15px] tracking-[0.16em] text-tva-gold";

export const eyebrow =
  "m-0 text-[10px] uppercase tracking-[0.28em] text-tva-gold";

export const stamp =
  "inline-block -rotate-6 border-2 border-tva-stamp px-1.5 py-px font-mono text-[10px] tracking-[0.14em] text-tva-stamp";

export const stampGold = "border-tva-gold text-tva-gold";

export const stampByAction: Record<string, string> = {
  added: "border-[#8f9a62] text-[#c6d18d]",
  deleted: "border-tva-stamp text-[#ff8a6a]",
  modified: "border-tva-gold text-tva-gold",
  moved: "border-tva-orange text-tva-orange-hot",
};

export const actionColor: Record<string, string> = {
  added: "text-[#c6d18d]",
  deleted: "text-[#ff8a6a]",
  modified: "text-tva-gold",
  moved: "text-tva-orange-hot",
};

export const fieldInput =
  "w-full border border-tva-gold/25 bg-[#120e0b] px-3 py-2.5 text-tva-paper outline-none focus:border-tva-orange focus:shadow-[inset_0_0_0_1px_var(--color-tva-orange-hot),0_0_0_1px_rgba(232,93,4,0.28)]";

export const fieldLabel =
  "text-[10px] uppercase tracking-[0.14em] text-tva-muted";

export const emptyText = "text-xs text-tva-paper-dim";

export const errorText = "mt-2.5 text-xs text-[#ff8a6a]";
