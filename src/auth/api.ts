import { githubLogout, githubWhoami } from "@/github/auth/api";
import type { ForgeUser } from "./types";

export async function whoami(): Promise<ForgeUser | null> {
  return githubWhoami();
}

export async function logout(): Promise<void> {
  return githubLogout();
}
