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
  const viewportRefBox = useRef(viewportRef);
  viewportRefBox.current = viewportRef;
  const contentW = contentWidth ?? 0;
  const contentH = contentHeight ?? 0;
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);

  const setViewportEl = useCallback((node: HTMLDivElement | null) => {
    innerRef.current = node;
    assignRef(viewportRefBox.current, node);
  }, []);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const next: Metrics = {
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      scrollW: Math.max(el.scrollWidth, contentW),
      scrollH: Math.max(el.scrollHeight, contentH),
      scrollL: el.scrollLeft,
      scrollT: el.scrollTop,
    };
    setMetrics((prev) => (metricsEqual(prev, next) ? prev : next));
  }, [contentH, contentW]);

  useLayoutEffect(() => {
    measure();
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
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
    const mo = new MutationObserver(syncChild);
    mo.observe(el, { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const allowX = axis === "x" || axis === "both";
  const allowY = axis === "y" || axis === "both";
  const shown = rails ?? axis;
  const railX = shown === "x" || shown === "both";
  const railY = shown === "y" || shown === "both";
  const showX = allowX && railX && metrics.scrollW > metrics.clientW + 1;
  const showY = allowY && railY && metrics.scrollH > metrics.clientH + 1;

  const rail = 10;
  const yTrack = Math.max(metrics.clientH, 0);
  const xTrack = Math.max(metrics.clientW, 0);
  const yThumbH = showY ? Math.max((metrics.clientH / metrics.scrollH) * yTrack, 28) : 0;
  const xThumbW = showX ? Math.max((metrics.clientW / metrics.scrollW) * xTrack, 28) : 0;
  const yMax = Math.max(metrics.scrollH - metrics.clientH, 0);
  const xMax = Math.max(metrics.scrollW - metrics.clientW, 0);
  const yThumbTop = yMax > 0 ? (metrics.scrollT / yMax) * Math.max(yTrack - yThumbH, 0) : 0;
  const xThumbLeft = xMax > 0 ? (metrics.scrollL / xMax) * Math.max(xTrack - xThumbW, 0) : 0;

  function scrollToY(next: number) {
    const el = innerRef.current;
    if (!el) return;
    el.scrollTop = clamp(next, 0, yMax);
  }

  function scrollToX(next: number) {
    const el = innerRef.current;
    if (!el) return;
    el.scrollLeft = clamp(next, 0, xMax);
  }

  function startDragY(e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScroll = metrics.scrollT;
    const travel = Math.max(yTrack - yThumbH, 1);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      scrollToY(startScroll + ((ev.clientY - startY) / travel) * yMax);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startDragX(e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startScroll = metrics.scrollL;
    const travel = Math.max(xTrack - xThumbW, 1);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      scrollToX(startScroll + ((ev.clientX - startX) / travel) * xMax);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function jumpY(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".tva-sb-thumb")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const travel = Math.max(rect.height - yThumbH, 1);
    const top = clamp(e.clientY - rect.top - yThumbH / 2, 0, travel);
    scrollToY((top / travel) * yMax);
  }

  function jumpX(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".tva-sb-thumb")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const travel = Math.max(rect.width - xThumbW, 1);
    const left = clamp(e.clientX - rect.left - xThumbW / 2, 0, travel);
    scrollToX((left / travel) * xMax);
  }

  const yStyle: CSSProperties = {
    height: yThumbH,
    transform: `translateY(${yThumbTop}px)`,
  };
  const xStyle: CSSProperties = {
    width: xThumbW,
    transform: `translateX(${xThumbLeft}px)`,
  };

  const viewportStyle: CSSProperties = {
    overflowX: allowX ? "auto" : "hidden",
    overflowY: allowY ? "auto" : "hidden",
  };

  return (
    <div
      className={["tva-scroll", fill ? "fill" : "", showX ? "has-x" : "", showY ? "has-y" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ "--tva-sb": `${rail}px` } as CSSProperties}
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
