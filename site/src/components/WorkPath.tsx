import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { SPECIMENS, type Topology } from "./specimens";
import { COMMITS } from "../lib/tourData";
import { useIsNarrow } from "../lib/useIsNarrow";

const ReviewDesk = lazy(() => import("./workpath/ReviewDesk").then((mod) => ({ default: mod.ReviewDesk })));
const PushDesk = lazy(() => import("./workpath/PushDesk").then((mod) => ({ default: mod.PushDesk })));
const PrDesk = lazy(() => import("./workpath/PrDesk").then((mod) => ({ default: mod.PrDesk })));

const STEPS = [
  {
    id: "01",
    title: "Open a repository and read the graph",
    body: "Manage your local working tree using Timestream. The default branch runs down the center. Other branches fork off as spurs. Click a commit to inspect it.",
    chips: ["local working tree", "commit graph", "libgit2"],
    wide: false,
  },
  {
    id: "02",
    title: "Review the diff and commit",
    body: "Staged, unstaged, and untracked files sit on the review desk. Select a file to read the hunk, stage it, then file the commit. No git CLI.",
    chips: ["stage", "diff", "commit"],
    wide: true,
  },
  {
    id: "03",
    title: "Push over SSH",
    body: "Choose an SSH key, start ssh-agent if needed, and transmit. Fast-forward only. No force-push. Tokens never land in settings.toml.",
    chips: ["ssh-agent", "ff-only", "no force-push"],
    wide: false,
    framed: false,
  },
  {
    id: "04",
    title: "Open the pull request",
    body: "HQ desk files GitHub pull requests as dockets: conversation, commits, and files. Sign in with a GitHub App device flow, or a PAT.",
    chips: ["device flow", "PRs", "issues"],
    wide: true,
    fillViewport: true,
  },
] as const;

function diamondPoints(cx: number, cy: number, r: number) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

function Chronomonitor({
  topology,
  selected,
  onSelect,
}: {
  topology: Topology;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const specimen = SPECIMENS.find((item) => item.id === topology) ?? SPECIMENS[0];
  const height = specimen.height ?? 280;
  const trunk = specimen.nodes.filter((node) => node.y === 140);
  return (
    <svg
      viewBox={`0 0 640 ${height}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={specimen.label}
    >
      <rect width="640" height={height} fill="#161310" />
      <path d="M0 140 H640" stroke="#E8B86D" strokeOpacity="0.12" strokeWidth="24" />
      {specimen.edges.map((edge) => (
        <path
          key={edge.d}
          d={edge.d}
          fill="none"
          stroke={edge.stroke}
          strokeWidth={edge.width ?? 5}
        />
      ))}
      {specimen.nodes.map((node, index) => {
        const trunkIndex = trunk.findIndex((item) => item.x === node.x && item.y === node.y);
        const clickable = trunkIndex >= 0 && trunkIndex < COMMITS.length;
        const active = clickable && trunkIndex === selected;
        const radius = active ? (node.r ?? 16) + 2 : (node.r ?? 16);
        const fill = active ? "#E85D04" : "#161310";
        const stroke = active ? "#F4C430" : node.stroke;
        return (
          <g key={`${node.x}-${node.y}-${index}`}>
            {node.tagged ? (
              <polygon
                points={diamondPoints(node.x, node.y, radius)}
                fill={fill}
                stroke={stroke}
                strokeWidth="2.5"
              />
            ) : (
              <circle cx={node.x} cy={node.y} r={radius} fill={fill} stroke={stroke} strokeWidth="2.5" />
            )}
            {clickable ? (
              <circle
                className="node-hit"
                cx={node.x}
                cy={node.y}
                r={36}
                onClick={() => onSelect(trunkIndex)}
              />
            ) : null}
          </g>
        );
      })}
      {(specimen.labels ?? []).map((label) => (
        <text
          key={`${label.text}-${label.x}-${label.y}`}
          className={`ref-label ${label.kind ?? "ref"}`}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          fill={label.fill}
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

function LocalDesk() {
  const [topology, setTopology] = useState<Topology>("linear");
  const [selected, setSelected] = useState(COMMITS.length - 1);
  const commit = COMMITS[selected] ?? COMMITS[0];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-tva-gold/16 px-3 py-2">
        <p className="eyebrow m-0">Commit graph</p>
        <div className="flex gap-1">
          {(["linear", "spurs"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`min-h-9 border px-2.5 py-1.5 text-[0.625rem] uppercase tracking-[0.14em] ${
                topology === id
                  ? "border-tva-orange bg-tva-orange/16 text-tva-gold-bright"
                  : "border-tva-gold/20 text-tva-muted"
              }`}
              onClick={() => setTopology(id)}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Chronomonitor topology={topology} selected={selected} onSelect={setSelected} />
      </div>
      <div className="border-t border-tva-gold/16 px-3 py-3">
        <p className="eyebrow mb-1">Selected</p>
        <p className="m-0 font-mono text-[0.75rem] text-tva-gold">{commit.sha}</p>
        <p className="mt-1 mb-0 text-[0.75rem] text-tva-paper">{commit.summary}</p>
        <p className="mt-1 mb-0 text-[0.625rem] uppercase tracking-[0.12em] text-tva-muted">{commit.author}</p>
      </div>
    </div>
  );
}

function DeskFrame({
  children,
  wide,
  fill,
  narrow,
}: {
  children: ReactNode;
  wide?: boolean;
  fill?: boolean;
  narrow?: boolean;
}) {
  const heightClass = fill
    ? "h-full min-h-0"
    : narrow
      ? "h-[min(78dvh,36rem)] min-h-[22rem]"
      : "h-[min(70vh,40rem)] min-h-[22rem]";
  return (
    <div
      className={`dossier relative flex flex-col ${heightClass} ${
        wide && !narrow ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden"
      }`}
    >
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-[#161310] ${wide ? "w-full min-w-0" : ""}`}>
        <Suspense
          fallback={
            <p className="m-0 px-4 py-6 text-[0.75rem] text-tva-muted">Loading desk…</p>
          }
        >
          {children}
        </Suspense>
      </div>
    </div>
  );
}

function StepDesk({ index }: { index: number }) {
  if (index === 0) return <LocalDesk />;
  if (index === 1) return <ReviewDesk />;
  if (index === 2) return <PushDesk />;
  return <PrDesk />;
}

/** Mount each desk only when its step nears the viewport — keeps Review/PR chunks off the critical path. */
function NearViewportDesk({
  index,
  wide,
  fill,
  framed = true,
}: {
  index: number;
  wide?: boolean;
  fill?: boolean;
  framed?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const narrow = useIsNarrow();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setActive(true);
        io.disconnect();
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = (
    <p className="m-0 px-4 py-6 text-[0.75rem] text-tva-muted">Loading desk…</p>
  );

  const placeholderHeight = fill
    ? "h-full"
    : narrow
      ? "h-[min(78dvh,36rem)]"
      : "h-[min(70vh,40rem)]";

  return (
    <div ref={ref} className={fill ? "h-full min-h-0" : undefined}>
      {!active ? (
        framed ? (
          <div className={`dossier relative flex flex-col ${placeholderHeight} ${fill ? "min-h-0" : "min-h-[22rem]"}`}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#161310]">{fallback}</div>
          </div>
        ) : (
          fallback
        )
      ) : framed ? (
        <DeskFrame wide={wide} fill={fill} narrow={narrow}>
          <StepDesk index={index} />
        </DeskFrame>
      ) : (
        <Suspense fallback={fallback}>
          <StepDesk index={index} />
        </Suspense>
      )}
    </div>
  );
}

export function WorkPath() {
  return (
    <section id="path" className="border-t border-tva-gold/16">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="flex flex-col gap-16 md:gap-24">
          {STEPS.map((step, index) => {
            const fillViewport = "fillViewport" in step && step.fillViewport;
            return (
              <article
                key={step.id}
                className={fillViewport ? undefined : "min-h-[min(72vh,38rem)]"}
              >
                <div
                  className={
                    step.wide
                      ? "flex flex-col gap-8"
                      : "grid items-start gap-8 lg:grid-cols-2 lg:gap-14"
                  }
                >
                  <div>
                    <p className="eyebrow mb-3">{step.id}</p>
                    <h3 className="mb-3 font-display text-2xl tracking-[0.04em] text-tva-gold">
                      {step.title}
                    </h3>
                    <p className="m-0 max-w-prose text-sm leading-relaxed text-tva-paper-dim">
                      {step.body}
                    </p>
                    <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
                      {step.chips.map((chip) => (
                        <li key={chip} className="chip">
                          {chip}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className={
                      fillViewport
                        ? "h-[calc(100dvh-var(--site-header)-1.5rem)] min-h-[22rem] max-h-[48rem]"
                        : step.wide
                          ? undefined
                          : "lg:sticky lg:top-24"
                    }
                  >
                    <NearViewportDesk
                      index={index}
                      wide={step.wide}
                      fill={fillViewport}
                      framed={!("framed" in step && step.framed === false)}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
