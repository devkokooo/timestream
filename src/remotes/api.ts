import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepoSummary } from "@/git/types";
import type { AheadBehind, RemoteAuthArgs, RemoteInfo } from "./types";

export async function pickRepository(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Submit a working tree for review",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function pickCloneDestination(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Clone destination",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export function listRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke("list_remotes", { path });
}

export function addRemote(path: string, name: string, url: string): Promise<RemoteInfo> {
  return invoke("add_remote", { path, name, url });
}

export function setRemoteUrl(path: string, name: string, url: string): Promise<RemoteInfo> {
  return invoke("set_remote_url", { path, name, url });
}

export function renameRemote(path: string, from: string, to: string): Promise<RemoteInfo> {
  return invoke("rename_remote", { path, from, to });
}

export function removeRemote(path: string, name: string): Promise<void> {
  return invoke("remove_remote", { path, name });
}

export function githubOrigin(path: string): Promise<RemoteInfo | null> {
  return invoke("github_origin", { path });
}

export function aheadBehind(path: string): Promise<AheadBehind> {
  return invoke("ahead_behind", { path });
}

export function fetchRemote(args: RemoteAuthArgs): Promise<AheadBehind> {
  return invoke("fetch_remote", { args });
}

export function pushBranch(
  args: RemoteAuthArgs,
  branch?: string,
  includeTags = false,
): Promise<AheadBehind> {
  return invoke("push_branch", {
    args,
    branch: branch ?? null,
    includeTags,
  });
}

export function pullFfOnly(args: RemoteAuthArgs, branch?: string): Promise<AheadBehind> {
  return invoke("pull_ff_only", { args, branch: branch ?? null });
}

export function cloneRepository(
  url: string,
  dest: string,
  auth?: Pick<
    RemoteAuthArgs,
    "keyPath" | "passphrase" | "rememberKey" | "rememberDefault" | "rememberPassphrase"
  >,
): Promise<RepoSummary> {
  return invoke("clone_repository", {
    url,
    dest,
    keyPath: auth?.keyPath ?? null,
    passphrase: auth?.passphrase ?? null,
    rememberKey: auth?.rememberKey ?? null,
    rememberDefault: auth?.rememberDefault ?? null,
    rememberPassphrase: auth?.rememberPassphrase ?? null,
  });
}

export function onCloneLog(handler: (line: string) => void): Promise<() => void> {
  return listen<string>("clone-log", (event) => handler(event.payload));
}

export function pushTag(args: RemoteAuthArgs, tag: string): Promise<void> {
  return invoke("push_tag", { args, tag });
}

export function deleteRemoteTag(args: RemoteAuthArgs, tag: string): Promise<void> {
  return invoke("delete_remote_tag", { args, tag });
}

export function checkoutPullRequest(args: RemoteAuthArgs, number: number): Promise<RepoSummary> {
  return invoke("checkout_pull_request", { args, number });
}

export function isSshIdentityError(err: unknown): boolean {
  return String(err).includes("SSH_IDENTITY_REQUIRED");
}

export function isPassphraseError(err: unknown): boolean {
  return String(err).includes("SSH_PASSPHRASE_REQUIRED");
}

export function isDivergedError(err: unknown): boolean {
  return String(err).includes("VARIANT_DIVERGED");
}
