export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  htmlUrl: string;
  userLogin: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  pullRequest: boolean;
  createdAt: string;
}

export interface IssueComment {
  id: number;
  userLogin: string;
  body: string;
  createdAt: string;
}

export interface CreateIssue {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}
