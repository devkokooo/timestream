import { cn } from "../lib/cn";

interface TvaTermProps {
  flavor: string;
  noun: string;
  hint?: string;
  className?: string;
  flavorClassName?: string;
  nounClassName?: string;
}

export function TvaTerm({
  flavor,
  noun,
  hint,
  className,
  flavorClassName,
  nounClassName,
}: TvaTermProps) {
  return (
    <span className={cn("inline-flex flex-col items-start leading-tight", className)}>
      <span className={cn("uppercase tracking-[0.08em]", flavorClassName)}>{flavor}</span>
      <span className={cn("text-[9px] font-normal normal-case tracking-normal text-tva-muted", nounClassName)}>
        {noun}
      </span>
      {hint ? <span className="sr-only">{hint}</span> : null}
    </span>
  );
}

export function HintMark({ label }: { label: string }) {
  return (
    <abbr
      title={label}
      className="ml-1 inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-tva-gold/40 text-[8px] font-semibold no-underline text-tva-gold"
    >
      ?
    </abbr>
  );
}
