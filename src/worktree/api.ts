import { invoke } from "@tauri-apps/api/core";
import type { StatusPayload } from "./types";

export function getStatus(path: string): Promise<StatusPayload> {
  return invoke("get_status", { path });
}

export function stageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("stage_file", { path, rel });
}

export function unstageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("unstage_file", { path, rel });
}

export function fileCommit(path: string, message: string, amend = false): Promise<string> {
  return invoke("file_commit", { path, message, amend });
}
