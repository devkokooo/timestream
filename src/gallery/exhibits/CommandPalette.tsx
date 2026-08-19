import { CommandPalette } from "@/settings/CommandPalette";
import { defaultSettings } from "@/settings/settingsRegistry";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function CommandPaletteExhibit({ scenario }: { scenario: Scenario }) {
  const commands =
    scenario === "empty"
      ? []
      : [
          { id: "open", title: "Open archive", hint: "Browse a working tree", run: noop },
          { id: "rescan", title: "Rescan timeline", hint: "Rebuild the graph", run: noop },
          { id: "settings", title: "Bureau settings", run: noop },
        ];
  return (
    <Frame>
      <CommandPalette
        open
        commands={commands}
        settings={defaultSettings()}
        onClose={noop}
        onOpenSetting={noop}
        onToggleSetting={noop}
      />
    </Frame>
  );
}
