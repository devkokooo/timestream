import { useEffect, useMemo, useRef, useState } from "react";
import { layoutTimelineView } from "../lib/timelineView";
import type { Timeline } from "../lib/types";

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SacredTimeline({ timeline, selectedId, onSelect }: Props) {
  const view = useMemo(() => layoutTimelineView(timeline), [timeline]);
  const [pan, setPan] = useState({ x: 40, y: 20, scale: 1 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );

  useEffect(() => {
    const head = view.nodes.find((n) => n.isHead) ?? view.nodes.at(-1);
    if (!head) return;
    setPan((p) => ({
      ...p,
      x: Math.max(40, 220 - head.x * p.scale),
      y: Math.max(10, 160 - view.sacredY * p.scale),
    }));
  }, [timeline.head, view.sacredY, view.nodes]);

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

  return (
    <svg
      className="monitor-svg"
      viewBox={`0 0 ${Math.max(view.width, 800)} ${Math.max(view.height, 360)}`}
      onWheel={(e) => {
        e.preventDefault();
        const next = Math.min(2.2, Math.max(0.35, pan.scale + (e.deltaY > 0 ? -0.08 : 0.08)));
        setPan((p) => ({ ...p, scale: next }));
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".node-hit")) return;
        drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setPan({
          ...pan,
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
        <radialGradient id="nexus" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d2" />
          <stop offset="45%" stopColor="#f4c430" />
          <stop offset="100%" stopColor="#e85d04" />
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

        {view.edges.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}-${edge.kind}`}
            d={edge.d}
            fill="none"
            stroke={edge.kind === "merge" ? "#c23b22" : edge.fromColumn === 0 && edge.toColumn === 0 ? "#f4c430" : "#e85d04"}
            strokeWidth={edge.fromColumn === 0 && edge.toColumn === 0 ? 3.2 : 1.7}
            strokeLinecap="round"
            opacity={edge.kind === "merge" ? 0.75 : 0.95}
            filter="url(#glow)"
          />
        ))}

        {view.nodes.map((node) => {
          const selected = node.id === selectedId;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)}>
              {node.isHead && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 10}
                  fill="none"
                  stroke="#f4c430"
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
                fill="url(#nexus)"
                stroke={selected ? "#fff6d2" : "#2b2118"}
                strokeWidth={selected ? 2 : 1}
                filter="url(#glow)"
              />
              <circle className="node-hit" cx={node.x} cy={node.y} r={16}>
                <title>
                  {node.shortId} — {node.summary}
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
            {label.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
