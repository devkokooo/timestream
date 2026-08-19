import { invoke } from "@tauri-apps/api/core";
import type { RepoSummary } from "./types";

export function openRepository(path: string): Promise<RepoSummary> {
  return invoke("open_repository", { path });
}
