import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  columnTone,
  focusCamera,
  INCURSION_ID,
  layoutTimelineView,
  lerpCamera,
  REF_TONE_FILL,
  type Camera,
  type ViewNode,
} from "../lib/timelineView";
import type { Timeline } from "../lib/types";

const DEFAULT_SCALE = 1.65;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2.8;
const FOCUS_MS = 480;

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReview?: () => void;
  incursion?: boolean;
  prHeadShas?: Set<string>;
  failingShas?: Set<string>;
}

export function SacredTimeline({
  timeline,
  selectedId,
  onSelect,
  onOpenReview,
  incursion = false,
  prHeadShas,
  failingShas,
}: Props) {
  const view = useMemo(() => layoutTimelineView(timeline, { incursion }), [timeline, incursion]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 400 });
  const [pan, setPan] = useState<Camera>({ x: 0, y: 0, scale: DEFAULT_SCALE });
  const panRef = useRef(pan);
  const animRef = useRef<number | null>(null);
  const focusIdRef = useRef<string | undefined>(undefined);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );

  const focus =
    view.nodes.find((n) => n.id === selectedId) ??
    view.nodes.find((n) => n.isHead) ??
    view.nodes.at(-1);

  const stopCameraAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const writePan = useCallback((next: Camera) => {
    panRef.current = next;
    setPan(next);
  }, []);

  const animateCamera = useCallback(
    (to: Camera) => {
      stopCameraAnim();
      const from = panRef.current;
      if (
        Math.abs(from.x - to.x) < 0.5 &&
        Math.abs(from.y - to.y) < 0.5 &&
        Math.abs(from.scale - to.scale) < 0.001
      ) {
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / FOCUS_MS);
        writePan(lerpCamera(from, to, t));
        if (t < 1) animRef.current = requestAnimationFrame(tick);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [stopCameraAnim, writePan],
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const apply = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      if (next.width < 2 || next.height < 2) return;
      setViewport((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => stopCameraAnim(), [stopCameraAnim]);

  useEffect(() => {
    if (!focus) return;
    const target = focusCamera(focus, panRef.current.scale, viewport);
    const first = focusIdRef.current === undefined;
    const idChanged = focusIdRef.current !== focus.id;
    focusIdRef.current = focus.id;
    if (first || !idChanged) {
      stopCameraAnim();
      writePan(target);
      return;
    }
    animateCamera(target);
  }, [
    animateCamera,
    focus,
    stopCameraAnim,
    viewport.height,
    viewport.width,
    writePan,
  ]);

  const ticks = useMemo(() => {
    const maxRow = timeline.nodes.reduce((m, n) => Math.max(m, n.row), 0);
    const step = maxRow > 40 ? 8 : maxRow > 16 ? 4 : 2;
    const out = [];
    for (let row = 0; row <= maxRow; row += step) {
      out.push({
        row,
        x: 88 + row * view.rowWidth,
        label: `T+${row}`,
      });
    }
    return out;
  }, [timeline.nodes, view.rowWidth]);

  const currentY = view.nodes.find((n) => n.isHead)?.y ?? view.sacredY;
  const toneOf = (column: number) => columnTone(column, view.currentColumn, view.nodes);

  return (
    <div className="relative h-full w-full">
    <svg
      ref={svgRef}
      className="monitor-svg"
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={(e) => {
        e.preventDefault();
        stopCameraAnim();
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * viewport.width;
        const my = ((e.clientY - rect.top) / rect.height) * viewport.height;
        const p = panRef.current;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, p.scale + (e.deltaY > 0 ? -0.1 : 0.1)));
        const gx = (mx - p.x) / p.scale;
        const gy = (my - p.y) / p.scale;
        writePan({ scale: nextScale, x: mx - gx * nextScale, y: my - gy * nextScale });
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".node-hit")) return;
        stopCameraAnim();
        const p = panRef.current;
        drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        writePan({
          ...panRef.current,
          x: drag.current.px + (e.clientX - drag.current.x),
          y: drag.current.py + (e.clientY - drag.current.y),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      <defs>
        <linearGradient id="river" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#8a5a22" />
          <stop offset="40%" stopColor="#f4c430" />
          <stop offset="100%" stopColor="#e85d04" />
        </linearGradient>
        <radialGradient id="nexus-current" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d2" />
          <stop offset="45%" stopColor="#f4c430" />
          <stop offset="100%" stopColor="#e85d04" />
        </radialGradient>
        <radialGradient id="nexus-local" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd4a8" />
          <stop offset="45%" stopColor="#e85d04" />
          <stop offset="100%" stopColor="#8a2e08" />
        </radialGradient>
        <radialGradient id="nexus-remote" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d4c19a" />
          <stop offset="50%" stopColor="#6b5d4d" />
          <stop offset="100%" stopColor="#3a332c" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="vein" width="18" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5 Q 4 1 9 5 T 18 5" stroke="#f4c430" strokeWidth="0.4" fill="none" opacity="0.35" />
        </pattern>
      </defs>

      <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}>
        <rect
          x="24"
          y={view.sacredY - 10}
          width={Math.max(view.width - 48, 200)}
          height="20"
          fill="url(#river)"
          opacity="0.22"
          rx="10"
          filter="url(#glow)"
        />
        <rect
          x="24"
          y={view.sacredY - 3}
          width={Math.max(view.width - 48, 200)}
          height="6"
          fill="url(#vein)"
          opacity="0.8"
        />

        <g className="ticks">
          {ticks.map((t) => (
            <g key={t.row}>
              <line
                x1={t.x}
                y1={view.sacredY - 14}
                x2={t.x}
                y2={view.sacredY + 14}
                stroke="#e8b86d"
                strokeOpacity="0.35"
              />
              <text x={t.x + 4} y={view.sacredY + 28}>
                {t.label}
              </text>
            </g>
          ))}
        </g>

        {currentY !== view.sacredY ? (
          <rect
            x="24"
            y={currentY - 7}
            width={Math.max(view.width - 48, 200)}
            height="14"
            fill={REF_TONE_FILL.current}
            opacity="0.14"
            rx="7"
            filter="url(#glow)"
          />
        ) : null}

        {view.edges.map((edge) => {
          const pending = edge.to === INCURSION_ID;
          const tone = pending ? "incursion" : toneOf(edge.toColumn);
          const currentLane =
            !pending && edge.fromColumn === view.currentColumn && edge.toColumn === view.currentColumn;
          return (
            <path
              key={`${edge.from}-${edge.to}-${edge.kind}`}
              d={edge.d}
              fill="none"
              stroke={
                pending
                  ? REF_TONE_FILL.incursion
                  : edge.kind === "merge"
                    ? "#c23b22"
                    : REF_TONE_FILL[tone]
              }
              strokeWidth={pending ? 1.8 : currentLane ? 3.2 : 1.7}
              strokeDasharray={pending ? "5 4" : tone === "remote" ? "4 3" : undefined}
              strokeLinecap="round"
              opacity={pending ? 0.72 : edge.kind === "merge" ? 0.75 : tone === "remote" ? 0.55 : 0.95}
              filter="url(#glow)"
            />
          );
        })}

        {view.nodes.map((node) => {
          if (node.id === INCURSION_ID) {
            return <IncursionOrb key={node.id} node={node} onOpen={() => onOpenReview?.()} />;
          }
          const selected = node.id === selectedId;
          const tone = node.isHead ? "current" : toneOf(node.column);
          const isPr = prHeadShas?.has(node.id);
          const failed = failingShas?.has(node.id);
          return (
            <g
              key={node.id}
              onClick={() => {
                if (node.id === selectedId) {
                  animateCamera(focusCamera(node, panRef.current.scale, viewport));
                }
                onSelect(node.id);
              }}
              opacity={tone === "remote" ? 0.55 : 1}
            >
              {node.isHead && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 10}
                  fill="none"
                  stroke={REF_TONE_FILL.current}
                  strokeDasharray="3 3"
                  opacity="0.8"
                >
                  <animate
                    attributeName="r"
                    values={`${node.r + 8};${node.r + 13};${node.r + 8}`}
                    dur="2.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={selected ? node.r + 2 : node.r}
                fill={`url(#nexus-${tone === "incursion" ? "local" : tone})`}
                stroke={
                  failed
                    ? "#c23b22"
                    : selected
                      ? "#fff6d2"
                      : node.isHead
                        ? REF_TONE_FILL.current
                        : tone === "local"
                          ? REF_TONE_FILL.local
                          : "#2b2118"
                }
                strokeWidth={failed || selected || node.isHead ? 2 : 1}
                filter="url(#glow)"
              />
              {isPr ? (
                <text x={node.x} y={node.y - node.r - 8} textAnchor="middle" className="ref-label" fill="#e85d04">
                  REQUEST
                  <title>Pull request</title>
                </text>
              ) : null}
              <circle className="node-hit" cx={node.x} cy={node.y} r={16}>
                <title>
                  {node.shortId} — {node.summary}
                  {failed ? " — Checks failed" : ""}
                  {isPr ? " — Pull request" : ""}
                </title>
              </circle>
            </g>
          );
        })}

        {view.labels.map((label) => (
          <text
            key={`${label.id}-${label.text}`}
            className={`ref-label ${label.kind}`}
            x={label.x}
            y={label.y + 12}
          >
            {label.segments.map((seg, i) => (
              <tspan key={`${seg.tone}-${seg.text}-${i}`} fill={REF_TONE_FILL[seg.tone]}>
                {i > 0 ? " · " : ""}
                {seg.text}
              </tspan>
            ))}
          </text>
        ))}
      </g>
    </svg>
    <div
      className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 font-mono text-[9px] tracking-[0.16em] text-tva-muted"
      aria-hidden
    >
      <span className="text-tva-gold-bright">NOW</span>
      <span className="text-tva-orange">LOCAL</span>
      <span>UPSTREAM</span>
    </div>
    </div>
  );
}

/** Forming nexus: filled, blinking — a timeline event the TVA has not yet filed. */
function IncursionOrb({ node, onOpen }: { node: ViewNode; onOpen: () => void }) {
  const r = node.r;
  return (
    <g className="incursion-node" onClick={onOpen}>
      <circle
        cx={node.x}
        cy={node.y}
        r={r + 8}
        fill="#e85d04"
        opacity="0.28"
        filter="url(#glow)"
      >
        <animate attributeName="opacity" values="0.12;0.4;0.12" dur="1.15s" repeatCount="indefinite" />
      </circle>
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill="url(#nexus-local)"
        stroke="#e85d04"
        strokeWidth="1.6"
        filter="url(#glow)"
      >
        <animate attributeName="opacity" values="0.35;1;0.35" dur="1.15s" repeatCount="indefinite" />
      </circle>
      <circle className="node-hit" cx={node.x} cy={node.y} r={18}>
        <title>Incursion — unfiled variance. Open the review desk.</title>
      </circle>
    </g>
  );
}
