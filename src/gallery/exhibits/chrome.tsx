import { btn, btnPrimary } from "@/ui/ui";
import { FileKindIcon } from "@/ui/FileKindIcon";
import { PersonName } from "@/auth/PersonName";
import { RailStrip } from "@/shell/RailStrip";
import { TransmitButton } from "@/ui/TransmitButton";
import { AnomalyColumnSkeleton, CaseFileDetailSkeleton } from "@/ui/TvaSkeleton";
import { TvaJumble } from "@/ui/TvaJumble";
import { HintMark, TvaTerm } from "@/ui/TvaTerm";
import { Frame, Pad, noop } from "../frame";
import type { Scenario } from "../scenario";

export function TransmitButtonExhibit({ scenario }: { scenario: Scenario }) {
  const busy = scenario === "loading";
  return (
    <Pad>
      <TransmitButton
        active={busy}
        disabled={scenario === "empty"}
        idleClass={btnPrimary}
        onClick={noop}
        title="File the working tree"
        label="Filing…"
        flavor="File"
        noun="Commit"
        busyNoun="Filing…"
        onPrimary
      />
      <TransmitButton
        active={busy}
        disabled={scenario === "empty"}
        idleClass={btn}
        onClick={noop}
        title="Fetch origin"
        label="Fetching…"
        flavor="Fetch"
        noun="Fetch origin"
        busyNoun="Fetching…"
      />
    </Pad>
  );
}

export function TvaSkeletonExhibit() {
  return (
    <Pad>
      <CaseFileDetailSkeleton />
      <AnomalyColumnSkeleton />
    </Pad>
  );
}

export function TvaJumbleExhibit() {
  return (
    <Pad>
      <TvaJumble label="Transmitting" noun="Transmit" />
      <TvaJumble label="Reading records" noun="Reading…" length={16} />
    </Pad>
  );
}

export function TvaTermExhibit() {
  return (
    <Pad>
      <TvaTerm flavor="Clearance" noun="Sign in with GitHub" />
      <TvaTerm flavor="File" noun="Commit" onPrimary />
      <p className="text-xs text-tva-paper">
        Chronomonitor
        <HintMark label="The Sacred Timeline graph." />
      </p>
    </Pad>
  );
}

export function FileKindIconExhibit() {
  const paths = [
    "src/lib/graph.rs",
    "src/App.tsx",
    "package.json",
    "Dockerfile",
    "README.md",
    "src/lib/graph.test.ts",
    "icons/icon.png",
    "archive.zip",
  ];
  return (
    <Pad>
      <div className="flex flex-wrap gap-4">
        {paths.map((path) => (
          <span key={path} className="inline-flex items-center gap-2 text-xs text-tva-paper-dim">
            <FileKindIcon path={path} />
            {path}
          </span>
        ))}
      </div>
    </Pad>
  );
}

export function PersonNameExhibit() {
  return (
    <Pad>
      <PersonName name="Analyst" email="analyst@tva.local" login="analyst" />
      <PersonName name="Minuteman" email="minute@tva.local" login="minuteman" />
    </Pad>
  );
}

export function RailStripExhibit() {
  return (
    <Frame className="flex-row">
      <RailStrip label="Variants" side="start" onExpand={noop} />
      <div className="flex-1" />
      <RailStrip label="Case file" side="end" onExpand={noop} />
    </Frame>
  );
}
