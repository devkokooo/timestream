import { useEffect, useState } from "react";

/** Below Tailwind `xl` — 3-pane review/PR desks + split diffs are too tight. */
const NARROW_QUERY = "(max-width: 1279px)";

/** Site tour: stack desks / prefer inline diffs under this width. */
export function useIsNarrow(query = NARROW_QUERY): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);

  return narrow;
}
