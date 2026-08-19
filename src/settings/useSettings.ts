import { useCallback, useEffect, useState } from "react";
import { getSettings, setSettings as persistSettings } from "@/settings/api";
import { defaultSettings } from "@/settings/settingsRegistry";
import type { SettingDef } from "@/settings/settingsRegistry";
import type { AppSettings } from "@/settings/types";

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void getSettings()
      .then(setSettingsState)
      .catch(() => {});
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const saved = await persistSettings(next);
    setSettingsState(saved);
    return saved;
  }, []);

  const toggleSetting = useCallback(
    async (def: SettingDef) => {
      const next = await persistSettings(def.set(settings, !def.get(settings)));
      setSettingsState(next);
      return next;
    },
    [settings],
  );

  const setTimelineEnabled = useCallback(
    async (enabled: boolean) => {
      return saveSettings({
        ...settings,
        timeline: { ...settings.timeline, enabled },
      });
    },
    [saveSettings, settings],
  );

  return {
    settings,
    setSettingsState,
    settingsOpen,
    setSettingsOpen,
    settingsFocus,
    setSettingsFocus,
    paletteOpen,
    setPaletteOpen,
    saveSettings,
    toggleSetting,
    setTimelineEnabled,
  };
}
