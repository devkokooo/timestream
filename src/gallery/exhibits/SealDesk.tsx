import { SealDesk } from "@/timeline/SealDesk";
import { TvaContextMenu } from "@/ui/TvaContextMenu";
import { TAGGED } from "../fixtures";
import { Frame, Pad, noop, noopAsync } from "../frame";
import type { Scenario } from "../scenario";

export function SealDeskExhibit({ scenario }: { scenario: Scenario }) {
  const node = TAGGED.nodes.find((n) => n.refs.some((r) => r.kind === "tag")) ?? TAGGED.nodes.at(-1)!;
  return (
    <Frame className="justify-end">
      <SealDesk
        open={scenario !== "empty"}
        target={
          scenario === "empty"
            ? null
            : { sha: node.id, shortId: node.shortId, summary: node.summary }
        }
        timeline={TAGGED}
        busy={scenario === "loading"}
        canPush={scenario === "success"}
        dispatchDefault={false}
        onDispatchDefault={noop}
        onClose={noop}
        onCreate={noopAsync}
      />
    </Frame>
  );
}

export function TvaContextMenuExhibit() {
  return (
    <Pad>
      <div className="relative h-48 w-full">
        <p className="m-0 text-xs text-tva-muted">Nexus context menu specimen</p>
        <TvaContextMenu
          menu={{
            x: 48,
            y: 64,
            items: [
              { id: "seal", label: "Seal this nexus", onSelect: noop },
              { id: "dossier", label: "Open dossier", onSelect: noop },
              { id: "cull", label: "Cull seal · v0.2.1", danger: true, onSelect: noop },
            ],
          }}
          onClose={noop}
        />
      </div>
    </Pad>
  );
}
