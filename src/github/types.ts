export type HqTab = "requests" | "incidents" | "canon";

export interface RepoFeatures {
  hasIssues: boolean;
  hasPullRequests: boolean;
  archived: boolean;
  htmlUrl: string;
}

export interface RepoSearchHit {
  fullName: string;
  description: string | null;
  sshUrl: string;
  cloneUrl: string;
  private: boolean;
}

export interface NotificationItem {
  id: string;
  reason: string;
  title: string;
  repo: string;
  kind: string;
  unread: boolean;
  updatedAt: string;
  url: string | null;
}
