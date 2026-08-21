import { TvaJumble } from "../../../src/ui/TvaJumble";

/** Large chronometer face used while WorkPath desks lazy-load. */
export function DeskLoading() {
  return (
    <div className="flex h-full min-h-56 flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      <svg
        className="desk-clock size-[min(11rem,42vw)] text-tva-gold"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <defs>
          <radialGradient id="desk-clock-face" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="#2a221a" />
            <stop offset="70%" stopColor="#161310" />
            <stop offset="100%" stopColor="#0e0b09" />
          </radialGradient>
          <filter id="desk-clock-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          className="desk-clock-rim"
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="url(#desk-clock-face)"
          stroke="#E85D04"
          strokeOpacity="0.45"
          strokeWidth="1.25"
        />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="#E8B86D"
          strokeOpacity="0.18"
          strokeWidth="0.75"
        />

        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const major = i % 3 === 0;
          const inner = major ? 34 : 38;
          const outer = 44;
          const x1 = 60 + inner * Math.sin(angle);
          const y1 = 60 - inner * Math.cos(angle);
          const x2 = 60 + outer * Math.sin(angle);
          const y2 = 60 - outer * Math.cos(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? "#F4C430" : "#E8B86D"}
              strokeOpacity={major ? 0.9 : 0.4}
              strokeWidth={major ? 2 : 1}
              strokeLinecap="square"
            />
          );
        })}

        {/* Hands pivot at origin via translate — CSS rotate then works reliably. */}
        <g transform="translate(60 60)">
          <g className="desk-clock-hour">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-28"
              stroke="#E8B86D"
              strokeWidth="3"
              strokeLinecap="square"
              filter="url(#desk-clock-glow)"
            />
          </g>
          <g className="desk-clock-minute">
            <line
              x1="0"
              y1="4"
              x2="0"
              y2="-38"
              stroke="#F4C430"
              strokeWidth="2"
              strokeLinecap="square"
              filter="url(#desk-clock-glow)"
            />
          </g>
          <g className="desk-clock-second">
            <line
              x1="0"
              y1="8"
              x2="0"
              y2="-42"
              stroke="#E85D04"
              strokeWidth="1.25"
              strokeLinecap="square"
            />
            <circle cx="0" cy="-42" r="1.5" fill="#E85D04" />
          </g>
          <circle r="4.5" fill="#161310" stroke="#F4C430" strokeWidth="1.5" />
          <circle r="2" fill="#E85D04" />
        </g>
      </svg>

      <TvaJumble
        label="Loading desk"
        noun="Loading desk…"
        length={14}
        className="items-center text-center"
      />
    </div>
  );
}
