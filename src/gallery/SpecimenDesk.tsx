import { useEffect, useMemo, useState } from "react";
import { AuthProvider } from "@/auth/AuthProvider";
import { cn } from "@/ui/cn";
import { btn, btnStow, eyebrow, stamp, stampChrome, stampGold } from "@/ui/ui";
import { RailStrip } from "@/shell/RailStrip";
import { ANALYST } from "./fixtures";
import { readHash, writeHash } from "./hash";
import { EXHIBITS, exhibitById } from "./registry";
import { SCENARIO_STAMP, setScenario, type Scenario } from "./scenario";

const GROUPS = ["Chrome", "Local", "GitHub"] as const;

export function SpecimenDesk() {
  const first = EXHIBITS[0];
  const [exhibitId, setExhibitId] = useState(first.id);
  const [stampId, setStampId] = useState<Scenario>(first.stamps[0]);
  const [railOpen, setRailOpen] = useState(true);

  useEffect(() => {
    const apply = () => {
      const route = readHash({ exhibit: first.id, scenario: first.stamps[0] });
      const found = exhibitById(route.exhibit) ?? first;
      const scenario = found.stamps.includes(route.scenario) ? route.scenario : found.stamps[0];
      setExhibitId(found.id);
      setStampId(scenario);
      setScenario(scenario);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [first.id, first.stamps]);

  function go(id: string, scenario: Scenario) {
    const found = exhibitById(id) ?? first;
    const next = found.stamps.includes(scenario) ? scenario : found.stamps[0];
    setExhibitId(found.id);
    setStampId(next);
    setScenario(next);
    writeHash({ exhibit: found.id, scenario: next });
  }

  const exhibit = exhibitById(exhibitId) ?? first;
  const grouped = useMemo(
    () => GROUPS.map((group) => ({ group, items: EXHIBITS.filter((item) => item.group === group) })),
    [],
  );

  return (
    <div className="flex h-full min-h-0 bg-[#161310] text-tva-paper">
      {railOpen ? (
        <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-tva-gold/16 px-3 py-3">
            <div>
              <p className={eyebrow}>Specimen desk</p>
              <h1 className="mt-1 mb-0 font-display text-[13px] tracking-[0.16em] text-tva-gold">CHRONOMONITOR</h1>
            </div>
            <button type="button" className={cn(btnStow, "m-0")} onClick={() => setRailOpen(false)}>
              Stow
            </button>
          </div>
          <nav className="min-h-0 flex-1 overflow-auto px-2 py-3">
            {grouped.map(({ group, items }) => (
              <div key={group} className="mb-4">
                <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.18em] text-tva-muted">{group}</p>
                <ul className="m-0 list-none p-0">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full border-0 px-2 py-1.5 text-left text-[11px] tracking-[0.04em]",
                          item.id === exhibit.id
                            ? "bg-tva-orange/16 text-tva-gold"
                            : "bg-transparent text-tva-paper-dim hover:bg-tva-orange/8 hover:text-tva-paper",
                        )}
                        onClick={() => go(item.id, stampId)}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
      ) : (
        <RailStrip label="Specimens" side="start" onExpand={() => setRailOpen(true)} />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-tva-gold/16 bg-[#1a1612] px-4 py-2">
          <p className="m-0 text-[11px] tracking-[0.08em] text-tva-gold">{exhibit.title}</p>
          <div className="flex flex-wrap gap-2">
            {exhibit.stamps.map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  stampChrome,
                  item === stampId ? `${stamp} ${stampGold} rotate-0` : `${stamp} rotate-0 opacity-55`,
                  btn,
                  "border-2 px-1.5 py-px",
                )}
                onClick={() => go(exhibit.id, item)}
              >
                {SCENARIO_STAMP[item]}
              </button>
            ))}
          </div>
        </header>
        <div className="relative min-h-0 min-w-0 flex-1 isolate [transform:translateZ(0)]">
          <AuthProvider user={ANALYST} key={`${exhibit.id}:${stampId}`}>
            {exhibit.render(stampId)}
          </AuthProvider>
        </div>
      </div>
    </div>
  );
}
