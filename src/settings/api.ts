import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";

export function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export function setSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke("set_settings", { settings });
}

export function settingsTomlPath(): Promise<string> {
  return invoke("settings_toml_path");
}
