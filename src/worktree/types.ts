import type { FileChange } from "@/git/types";

export interface StatusPayload {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
}
