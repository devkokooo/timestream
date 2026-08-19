import { invoke } from "@tauri-apps/api/core";
import type { CommitDetail, Timeline } from "./types";

export function getTimeline(path: string): Promise<Timeline> {
  return invoke("get_timeline", { path });
}

export function getCommit(path: string, sha: string): Promise<CommitDetail> {
  return invoke("get_commit", { path, sha });
}

export function createLocalTag(
  path: string,
  name: string,
  sha: string,
  message?: string,
): Promise<void> {
  return invoke("create_local_tag", { path, name, sha, message: message ?? null });
}

export function deleteLocalTag(path: string, name: string): Promise<void> {
  return invoke("delete_local_tag", { path, name });
}
