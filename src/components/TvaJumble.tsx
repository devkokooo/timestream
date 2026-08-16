import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { jumbleFrame } from "../lib/jumble";

interface Props {
  label?: string;
  noun?: string;
  length?: number;
  className?: string;
}

export function TvaJumble({
  label = "Transmitting",
  noun = "Transmit",
  length = 12,
  className,
}: Props) {
  const [frame, setFrame] = useState(() => jumbleFrame(length));

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => setFrame(jumbleFrame(length)), 90);
    return () => window.clearInterval(id);
  }, [length]);

  return (
    <span
      className={cn("inline-flex flex-col items-start leading-tight", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="tva-jumble tabular-nums tracking-[0.14em] text-tva-gold" aria-hidden>
        {frame}
      </span>
      <span className="text-[9px] font-normal normal-case tracking-normal text-tva-orange">{noun}</span>
    </span>
  );
}
