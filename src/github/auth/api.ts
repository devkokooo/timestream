import { invoke } from "@tauri-apps/api/core";
import type { ForgeUser } from "@/auth/types";
import type { DeviceLoginBegin } from "./types";

export function githubLoginBegin(): Promise<DeviceLoginBegin> {
  return invoke("github_login_begin");
}

export function githubLoginPoll(deviceCode: string): Promise<ForgeUser | null> {
  return invoke("github_login_poll", { deviceCode });
}

export function githubLoginPat(token: string): Promise<ForgeUser> {
  return invoke("github_login_pat", { token });
}

export function githubWhoami(): Promise<ForgeUser | null> {
  return invoke("github_whoami");
}

export function githubLogout(): Promise<void> {
  return invoke("github_logout");
}
