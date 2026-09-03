import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";

type Axis = "x" | "y" | "both";

interface Props {
  children: ReactNode;
  className?: string;
  /** Which overflow axes are enabled. */
  axis?: Axis;
  /** Which overlay rails to draw. Defaults to `axis`. */
  rails?: Axis;
  /** Stretch to fill a flex/grid parent (panels). Off for content-sized rows. */
  fill?: boolean;
  viewportClassName?: string;
  /** Expose the scrolling viewport for virtualizers. */
  viewportRef?: Ref<HTMLDivElement | null>;
  onScroll?: () => void;
  /** Virtual lists: true content extent when absolutely positioned rows shrink scrollHeight. */
  contentWidth?: number;
  contentHeight?: number;
}

interface Metrics {
  clientW: number;
  clientH: number;
  scrollW: number;
  scrollH: number;
  scrollL: number;
  scrollT: number;
}

const EMPTY: Metrics = {
  clientW: 0,
  clientH: 0,
  scrollW: 0,
  scrollH: 0,
  scrollL: 0,
  scrollT: 0,
};

const RAIL_PX = 10;

/**
 * Track scroll metrics on an external element (e.g. Pierre CodeView host)
 * and drive TVA overlay rails without wrapping it in an inner viewport.
 */
export function useTvaScrollTarget(
  target: HTMLElement | null,
  opts?: {
    axis?: Axis;
    rails?: Axis;
    contentWidth?: number;
    contentHeight?: number;
    /** Watch virtualized/shadow subtree size changes (Pierre CodeView). */
    deep?: boolean;
    /**
     * Extra scrollers to keep in lockstep (e.g. split-diff `[data-code]` panes).
     * Metrics still come from `target`.
     */
    syncTargets?: readonly HTMLElement[];
  },
) {
  const axis = opts?.axis ?? "both";
  const contentW = opts?.contentWidth ?? 0;
  const contentH = opts?.contentHeight ?? 0;
  const deep = opts?.deep ?? false;
  const syncTargets = opts?.syncTargets;
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);

  const measure = useCallback(() => {
    const el = target;
    if (!el) {
      setMetrics(EMPTY);
      return;
    }
    const next: Metrics = {
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      scrollW: Math.max(el.scrollWidth, contentW),
      scrollH: Math.max(el.scrollHeight, contentH),
      scrollL: el.scrollLeft,
      scrollT: el.scrollTop,
    };
    setMetrics((prev) => (metricsEqual(prev, next) ? prev : next));
  }, [contentH, contentW, target]);

  useLayoutEffect(() => {
    measure();
    const el = target;
    if (!el) return;
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const extras = syncTargets ?? [];
    for (const other of extras) {
      if (other === el) continue;
      other.addEventListener("scroll", onScroll, { passive: true });
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const other of extras) {
      if (other !== el) ro.observe(other);
    }
    let child: Element | null = null;
    const syncChild = () => {
      const next = el.firstElementChild;
      if (next === child) {
        measure();
        return;
      }
      if (child) ro.unobserve(child);
      child = next;
      if (child) ro.observe(child);
      measure();
    };
    syncChild();
    const mo = new MutationObserver(deep ? measure : syncChild);
    mo.observe(el, deep ? { childList: true, subtree: true } : { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", onScroll);
      for (const other of extras) {
        if (other !== el) other.removeEventListener("scroll", onScroll);
      }
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [deep, measure, syncTargets, target]);

  const allowX = axis === "x" || axis === "both";
  const allowY = axis === "y" || axis === "both";
  const shown = opts?.rails ?? axis;
  const railX = shown === "x" || shown === "both";
  const railY = shown === "y" || shown === "both";
  const showX = allowX && railX && metrics.scrollW > metrics.clientW + 1;
  const showY = allowY && railY && metrics.scrollH > metrics.clientH + 1;

  const yTrack = Math.max(metrics.clientH, 0);
  const xTrack = Math.max(metrics.clientW, 0);
  const yThumbH = showY ? Math.max((metrics.clientH / metrics.scrollH) * yTrack, 28) : 0;
  const xThumbW = showX ? Math.max((metrics.clientW / metrics.scrollW) * xTrack, 28) : 0;
  const yMax = Math.max(metrics.scrollH - metrics.clientH, 0);
  const xMax = Math.max(metrics.scrollW - metrics.clientW, 0);
  const yThumbTop = yMax > 0 ? (metrics.scrollT / yMax) * Math.max(yTrack - yThumbH, 0) : 0;
  const xThumbLeft = xMax > 0 ? (metrics.scrollL / xMax) * Math.max(xTrack - xThumbW, 0) : 0;

  const peers = useCallback((): HTMLElement[] => {
    const list = [target, ...(syncTargets ?? [])].filter(Boolean) as HTMLElement[];
    return [...new Set(list)];
  }, [syncTargets, target]);

  const scrollToY = useCallback(
    (next: number) => {
      const value = clamp(next, 0, yMax);
      for (const el of peers()) el.scrollTop = value;
    },
    [peers, yMax],
  );

  const scrollToX = useCallback(
    (next: number) => {
      const value = clamp(next, 0, xMax);
      for (const el of peers()) el.scrollLeft = value;
    },
    [peers, xMax],
  );

  const startDragY = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startScroll = metrics.scrollT;
      const travel = Math.max(yTrack - yThumbH, 1);
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        scrollToY(startScroll + ((ev.clientY - startY) / travel) * yMax);
      };
      const onUp = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [metrics.scrollT, scrollToY, yMax, yThumbH, yTrack],
  );

  const startDragX = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startScroll = metrics.scrollL;
      const travel = Math.max(xTrack - xThumbW, 1);
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        scrollToX(startScroll + ((ev.clientX - startX) / travel) * xMax);
      };
      const onUp = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [metrics.scrollL, scrollToX, xMax, xThumbW, xTrack],
  );

  const jumpY = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".tva-sb-thumb")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const travel = Math.max(rect.height - yThumbH, 1);
      const top = clamp(e.clientY - rect.top - yThumbH / 2, 0, travel);
      scrollToY((top / travel) * yMax);
    },
    [scrollToY, yMax, yThumbH],
  );

  const jumpX = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".tva-sb-thumb")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const travel = Math.max(rect.width - xThumbW, 1);
      const left = clamp(e.clientX - rect.left - xThumbW / 2, 0, travel);
      scrollToX((left / travel) * xMax);
    },
    [scrollToX, xMax, xThumbW],
  );

  return {
    metrics,
    measure,
    showX,
    showY,
    railPx: RAIL_PX,
    yStyle: { height: yThumbH, transform: `translateY(${yThumbTop}px)` } as CSSProperties,
    xStyle: { width: xThumbW, transform: `translateX(${xThumbLeft}px)` } as CSSProperties,
    jumpY,
    jumpX,
    startDragY,
    startDragX,
  };
}

/** Overlay rails matching `.tva-sb*` chrome (gradient thumb + grab cursor). */
export function TvaScrollRails({
  showX,
  showY,
  yStyle,
  xStyle,
  jumpY,
  jumpX,
  startDragY,
  startDragX,
}: Pick<
  ReturnType<typeof useTvaScrollTarget>,
  "showX" | "showY" | "yStyle" | "xStyle" | "jumpY" | "jumpX" | "startDragY" | "startDragX"
>) {
  return (
    <>
      {showY ? (
        <div className="tva-sb tva-sb-y" onPointerDown={jumpY} aria-hidden>
          <div className="tva-sb-thumb" style={yStyle} onPointerDown={startDragY} />
        </div>
      ) : null}
      {showX ? (
        <div className="tva-sb tva-sb-x" onPointerDown={jumpX} aria-hidden>
          <div className="tva-sb-thumb" style={xStyle} onPointerDown={startDragX} />
        </div>
      ) : null}
      {showX && showY ? <div className="tva-sb-corner" aria-hidden /> : null}
    </>
  );
}

/**
 * Overlay scroll area for Tauri webviews.
 *
 * Native scrollbar CSS is inconsistent: WebView2 (Windows) honors
 * `::-webkit-scrollbar`, WKWebView (macOS) mostly ignores it / uses overlays,
 * WebKitGTK varies. Hiding the OS chrome and drawing TVA rails works everywhere.
 */
export function TvaScrollArea({
  children,
  className = "",
  axis = "both",
  rails,
  fill = false,
  viewportClassName = "",
  viewportRef,
  onScroll,
  contentWidth,
  contentHeight,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [viewportEl, setViewportElState] = useState<HTMLDivElement | null>(null);
  const viewportRefBox = useRef(viewportRef);
  viewportRefBox.current = viewportRef;

  const setViewportEl = useCallback((node: HTMLDivElement | null) => {
    innerRef.current = node;
    setViewportElState(node);
    assignRef(viewportRefBox.current, node);
  }, []);

  const scroll = useTvaScrollTarget(viewportEl, { axis, rails, contentWidth, contentHeight });
  const { measure, showX, showY } = scroll;

  const allowX = axis === "x" || axis === "both";
  const allowY = axis === "y" || axis === "both";

  const viewportStyle: CSSProperties = {
    overflowX: allowX ? "auto" : "hidden",
    overflowY: allowY ? "auto" : "hidden",
  };

  return (
    <div
      className={["tva-scroll", fill ? "fill" : "", showX ? "has-x" : "", showY ? "has-y" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ "--tva-sb": `${RAIL_PX}px` } as CSSProperties}
    >
      <div
        ref={setViewportEl}
        className={`tva-scroll-viewport ${viewportClassName}`.trim()}
        style={viewportStyle}
        onScroll={() => {
          measure();
          onScroll?.();
        }}
      >
        {children}
      </div>
      <TvaScrollRails {...scroll} />
    </div>
  );
}

function metricsEqual(a: Metrics, b: Metrics): boolean {
  return (
    a.clientW === b.clientW &&
    a.clientH === b.clientH &&
    a.scrollW === b.scrollW &&
    a.scrollH === b.scrollH &&
    a.scrollL === b.scrollL &&
    a.scrollT === b.scrollT
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}
