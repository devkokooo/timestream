import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { quantizeRect, rectKey } from "../lib/cull";
import {
  clipRiverX,
  cullTimelineView,
  diamondPoints,
  focusCamera,
  hasTag,
  INCURSION_ID,
  indexTimelineView,
  laneTones,
  layoutTimelineView,
  lerpCamera,
  REF_TONE_FILL,
  timelineLod,
  tooltipPlacement,
  worldRect,
  xInRect,
  type Camera,
  type ViewNode,
} from "../lib/timelineView";
import type { CommitDetail, Timeline } from "../lib/types";
import { NexusDossier } from "./NexusDossier";
import { NexusTooltip } from "./NexusTooltip";

const DEFAULT_SCALE = 1.65;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2.8;
const FOCUS_MS = 480;
const CULL_CELL = 80;

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenReview?: () => void;
  incursion?: boolean;
  detail?: CommitDetail | null;
  reviewers?: string[];
  reviewDecision?: string | null;
  checks?: string | null;
  prHeadShas?: Set<string>;
  failingShas?: Set<string>;
  onSelectCommit?: (id: string) => void;
  onOpenFile?: (path: string) => void;
}

export function SacredTimeline({
  timeline,
  selectedId,
  onSelect,
  onOpenReview,
  incursion = false,
  detail,
  reviewers,
  reviewDecision,
  checks,
  prHeadShas,
  failingShas,
  onSelectCommit,
  onOpenFile,
}: Props) {
  const view = useMemo(() => layoutTimelineView(timeline, { incursion }), [timeline, incursion]);
  const index = useMemo(() => indexTimelineView(view), [view]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const worldRef = useRef<SVGGElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: 800, height: 400 });
  const [pan, setPan] = useState<Camera>({ x: 0, y: 0, scale: DEFAULT_SCALE });
  const panRef = useRef(pan);
  const viewportRef = useRef(viewport);
  const selectedNodeRef = useRef<ViewNode | undefined>(undefined);
  const cullKeyRef = useRef("");
  const animRef = useRef<number | null>(null);
  const focusIdRef = useRef<string | undefined>(undefined);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  viewportRef.current = viewport;

  const selectedNode =
    selectedId && selectedId !== INCURSION_ID ? index.nodeById.get(selectedId) : undefined;
  selectedNodeRef.current = selectedNode;

  const placeTip = useCallback((cam: Camera) => {
    const el = tipRef.current;
    const node = selectedNodeRef.current;
    if (!el || !node) return;
    const place = tooltipPlacement(node, cam, viewportRef.current, {
      w: el.offsetWidth,
      h: el.offsetHeight,
    });
    el.dataset.side = place.side;
    el.style.visibility = "visible";
    el.style.transform =
      place.side === "above"
        ? `translate(${place.x}px, ${place.y}px) translate(-50%, -100%)`
        : `translate(${place.x}px, ${place.y}px) translate(-50%, 0)`;
  }, []);

  const focus =
    (selectedId ? index.nodeById.get(selectedId) : undefined) ??
    view.head ??
    view.nodes.at(-1);

  const stopCameraAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const paintCamera = useCallback((next: Camera) => {
    panRef.current = next;
    worldRef.current?.setAttribute(
      "transform",
      `translate(${next.x} ${next.y}) scale(${next.scale})`,
    );
    placeTip(next);
  }, [placeTip]);

  const writePan = useCallback((next: Camera) => {
    paintCamera(next);
    const q = quantizeRect(worldRect(next, viewport), CULL_CELL);
    cullKeyRef.current = `${rectKey(q)}:${next.scale <= 0.8 ? 0 : 1}`;
    setPan(next);
  }, [paintCamera, viewport]);

  const nudgeCamera = useCallback(
    (next: Camera) => {
      paintCamera(next);
      const q = quantizeRect(worldRect(next, viewport), CULL_CELL);
      const key = `${rectKey(q)}:${next.scale <= 0.8 ? 0 : 1}`;
      if (key === cullKeyRef.current) return;
      cullKeyRef.current = key;
      setPan(next);
    },
    [paintCamera, viewport],
  );

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
        const pose = lerpCamera(from, to, t);
        if (t < 1) {
          nudgeCamera(pose);
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
          writePan(pose);
        }
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [nudgeCamera, stopCameraAnim, writePan],
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
    if (!selectedId) setDossierOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!dossierOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDossierOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dossierOpen]);

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

  useLayoutEffect(() => {
    const cam = panRef.current;
    worldRef.current?.setAttribute(
      "transform",
      `translate(${cam.x} ${cam.y}) scale(${cam.scale})`,
    );
    placeTip(cam);
  });

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    placeTip(panRef.current);
    const observer = new ResizeObserver(() => placeTip(panRef.current));
    observer.observe(el);
    return () => observer.disconnect();
  }, [placeTip, selectedId]);

  const ticks = useMemo(() => {
    const maxRow = view.maxRow;
    const step = pan.scale <= 0.6 ? 16 : maxRow > 40 ? 8 : maxRow > 16 ? 4 : 2;
    const out = [];
    for (let row = 0; row <= maxRow; row += step) {
      out.push({
        row,
        x: 88 + row * view.rowWidth,
        label: `T+${row}`,
      });
    }
    return out;
  }, [pan.scale, view.maxRow, view.rowWidth]);

  const rect = useMemo(() => quantizeRect(worldRect(pan, viewport), CULL_CELL), [pan, viewport]);
  const keepIds = useMemo(() => {
    const ids = new Set<string>([INCURSION_ID]);
    if (selectedId) ids.add(selectedId);
    if (view.head) ids.add(view.head.id);
    return ids;
  }, [selectedId, view.head]);
  const lod = useMemo(() => {
    const visibleRows = rect.w / view.rowWidth;
    return timelineLod(pan.scale, visibleRows);
  }, [pan.scale, rect.w, view.rowWidth]);
  const culled = useMemo(
    () => cullTimelineView(view, rect, keepIds, index, lod),
    [index, keepIds, lod, rect, view],
  );
  const tones = useMemo(() => laneTones(view.nodes, view.currentColumn), [view]);
  const toneOf = (column: number) => tones.get(column) ?? "local";
  const river = clipRiverX(view, rect);
  const visibleTicks = useMemo(() => ticks.filter((t) => xInRect(t.x, rect)), [ticks, rect]);

  const currentY = view.head?.y ?? view.sacredY;

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
        nudgeCamera({ scale: nextScale, x: mx - gx * nextScale, y: my - gy * nextScale });
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".node-hit")) return;
        stopCameraAnim();
        const p = panRef.current;
        drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        nudgeCamera({
          ...panRef.current,
          x: drag.current.px + (e.clientX - drag.current.x),
          y: drag.current.py + (e.clientY - drag.current.y),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
        writePan(panRef.current);
      }}
      onPointerLeave={() => {
        if (!drag.current) return;
        drag.current = null;
        writePan(panRef.current);
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
        <radialGradient id="nexus-tag" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d2" />
          <stop offset="40%" stopColor="#e8b86d" />
          <stop offset="100%" stopColor="#8a5a22" />
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

      <g ref={worldRef} className="monitor-world">
        {river ? (
          <g>
            <rect
              x={river.x}
              y={view.sacredY - 10}
              width={river.width}
              height="20"
              fill="url(#river)"
              opacity="0.22"
              rx="10"
            />
            <rect
              x={river.x}
              y={view.sacredY - 3}
              width={river.width}
              height="6"
              fill="url(#vein)"
              opacity="0.8"
            />
          </g>
        ) : null}

        <g className="ticks">
          {visibleTicks.map((t) => (
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

        {currentY !== view.sacredY && river ? (
          <rect
            x={river.x}
            y={currentY - 7}
            width={river.width}
            height="14"
            fill={REF_TONE_FILL.current}
            opacity="0.14"
            rx="7"
          />
        ) : null}

        {culled.edges.map((edge) => {
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
              strokeWidth={pending ? 1.6 : currentLane ? 3.2 : 1.15}
              strokeDasharray={pending ? "5 4" : tone === "remote" ? "4 3" : undefined}
              strokeLinecap="round"
              opacity={pending ? 0.72 : edge.kind === "merge" ? 0.75 : tone === "remote" ? 0.55 : 0.95}
            />
          );
        })}

        {culled.nodes.map((node) => {
          if (node.id === INCURSION_ID) {
            return <IncursionOrb key={node.id} node={node} onOpen={() => onOpenReview?.()} />;
          }
          const selected = node.id === selectedId;
          const tagged = hasTag(node);
          const tone = node.isHead ? "current" : tagged ? "tag" : toneOf(node.column);
          const isPr = prHeadShas?.has(node.id);
          const failed = failingShas?.has(node.id);
          const glow = node.isHead || selected || tagged;
          const markR = selected ? node.r + 2 : tagged ? node.r + 1 : node.r;
          const stroke = failed
            ? "#c23b22"
            : selected
              ? "#fff6d2"
              : node.isHead
                ? REF_TONE_FILL.current
                : tagged
                  ? REF_TONE_FILL.tag
                  : tone === "local"
                    ? REF_TONE_FILL.local
                    : "#2b2118";
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
              {tagged ? (
                <polygon
                  points={diamondPoints(node.x, node.y, markR)}
                  fill="url(#nexus-tag)"
                  stroke={stroke}
                  strokeWidth={failed || selected || node.isHead ? 2 : 1.2}
                  filter={glow ? "url(#glow)" : undefined}
                />
              ) : (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={markR}
                  fill={`url(#nexus-${tone === "incursion" ? "local" : tone})`}
                  stroke={stroke}
                  strokeWidth={failed || selected || node.isHead ? 2 : 1}
                  filter={glow ? "url(#glow)" : undefined}
                />
              )}
              {isPr ? (
                <text x={node.x} y={node.y - node.r - 8} textAnchor="middle" className="ref-label" fill="#e85d04">
                  REQUEST
                  <title>Pull request</title>
                </text>
              ) : null}
              <circle className="node-hit" cx={node.x} cy={node.y} r={16}>
                {selected ? null : (
                  <title>
                    {node.shortId} — {node.summary}
                    {tagged ? " — Canon tag" : ""}
                    {failed ? " — Checks failed" : ""}
                    {isPr ? " — Pull request" : ""}
                  </title>
                )}
              </circle>
            </g>
          );
        })}

        {culled.labels.map((label) => (
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
    {selectedNode && !dossierOpen ? (
      <NexusTooltip
        key={selectedNode.id}
        node={selectedNode}
        tipRef={tipRef}
        body={detail?.id === selectedNode.id ? detail.body : null}
        committer={detail?.id === selectedNode.id ? detail.committer : null}
        committerEmail={detail?.id === selectedNode.id ? detail.committerEmail : null}
        filedAt={detail?.id === selectedNode.id ? detail.committerTimestamp : null}
        isPr={prHeadShas?.has(selectedNode.id)}
        failed={failingShas?.has(selectedNode.id)}
        onExpand={() => setDossierOpen(true)}
      />
    ) : null}
    {selectedNode && dossierOpen ? (
      <NexusDossier
        node={selectedNode}
        detail={detail?.id === selectedNode.id ? detail : null}
        reviewers={reviewers}
        reviewDecision={reviewDecision}
        checks={checks}
        isPr={prHeadShas?.has(selectedNode.id)}
        failed={failingShas?.has(selectedNode.id)}
        onStow={() => setDossierOpen(false)}
        onSelectCommit={onSelectCommit ?? onSelect}
        onOpenFile={onOpenFile}
      />
    ) : null}
    <div
      className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 font-mono text-[9px] tracking-[0.16em] text-tva-muted"
      aria-hidden
    >
      <span className="text-tva-gold-bright">NOW</span>
      <span className="text-tva-orange">LOCAL</span>
      <span className="text-tva-gold">CANON</span>
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
