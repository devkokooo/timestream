export interface RepoSummary {
  path: string;
  name: string;
  head: string | null;
  branch: string | null;
}

export interface FileChange {
  path: string;
  oldPath: string | null;
  status: string;
}
