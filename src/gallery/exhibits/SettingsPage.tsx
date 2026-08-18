import { useEffect, useState } from "react";
import { SettingsPage } from "../../components/SettingsPage";
import { defaultSettings } from "../../lib/settingsRegistry";
import { settingsWithKey } from "../fixtures";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function SettingsPageExhibit({ scenario }: { scenario: Scenario }) {
  const [settings, setSettings] = useState(
    scenario === "empty" ? defaultSettings() : settingsWithKey(),
  );
  useEffect(() => {
    setSettings(scenario === "empty" ? defaultSettings() : settingsWithKey());
  }, [scenario]);
  return (
    <Frame>
      <SettingsPage open settings={settings} onClose={noop} onChange={setSettings} />
    </Frame>
  );
}
