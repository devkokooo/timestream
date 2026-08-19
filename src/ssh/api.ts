import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { SshAgentStatus, SshKeyInfo } from "./types";

export async function pickSshKey(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    title: "Select an SSH private key",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export function listSshKeys(): Promise<SshKeyInfo[]> {
  return invoke("list_ssh_keys");
}

export function sshAgentStatus(): Promise<SshAgentStatus> {
  return invoke("ssh_agent_status");
}

export function sshAgentEnsure(): Promise<SshAgentStatus> {
  return invoke("ssh_agent_ensure");
}

export function sshAddKey(path: string, passphrase?: string): Promise<SshAgentStatus> {
  return invoke("ssh_add_key", { path, passphrase: passphrase ?? null });
}
