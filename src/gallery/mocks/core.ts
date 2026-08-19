import type { AppSettings } from "@/settings/types";
import {
  AGENT_DOWN,
  AGENT_UP,
  ANALYST,
  CHECKS,
  commitDetail,
  DEVICE_BEGIN,
  EMPTY_DIFF,
  EMPTY_STATUS,
  FEATURES,
  ISSUE_COMMENTS,
  ISSUES,
  LINEAR,
  MANY_BRANCHES,
  ORIGIN,
  PULL,
  PULL_COMMITS,
  PULL_COUNTS,
  PULLS,
  RANGE,
  RELEASES,
  REPO,
  REVIEW_COMMENTS,
  REVIEWS,
  SEARCH_HITS,
  SSH_KEYS,
  STATUS,
  SYNC,
  TEXT_DIFF,
  settingsWithKey,
} from "../fixtures";
import { getScenario, neverResolves, SPECIMEN_AUTH, SPECIMEN_ERROR, SPECIMEN_FORBIDDEN, SPECIMEN_OUTAGE, SPECIMEN_RATE_LIMIT } from "../scenario";

function hang<T>(): Promise<T> {
  return neverResolves();
}

function fail(message = SPECIMEN_ERROR): never {
  throw new Error(message);
}

function settings(): AppSettings {
  return settingsWithKey();
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const scenario = getScenario();
  if (scenario === "loading") return hang();
  if (scenario === "error") fail();
  if (scenario === "outage") fail(SPECIMEN_OUTAGE);
  if (scenario === "rate-limit") fail(SPECIMEN_RATE_LIMIT);
  if (scenario === "auth") fail(SPECIMEN_AUTH);
  if (scenario === "forbidden") fail(SPECIMEN_FORBIDDEN);

  const empty = scenario === "empty";

  switch (cmd) {
    case "open_repository":
    case "switch_branch":
    case "create_local_branch":
    case "rename_local_branch":
    case "checkout_pull_request":
    case "clone_repository":
      return (empty ? { ...REPO, head: null, branch: null } : REPO) as T;
    case "get_timeline":
      return (empty ? { sacredBranch: "main", head: null, nodes: [], edges: [], dossiers: [] } : MANY_BRANCHES) as T;
    case "get_status":
    case "stage_file":
    case "unstage_file":
      return (empty ? EMPTY_STATUS : STATUS) as T;
    case "get_commit":
      return commitDetail(String(args?.sha ?? LINEAR.nodes.at(-1)?.id), empty ? [] : undefined) as T;
    case "get_file_diff":
    case "get_worktree_diff":
    case "get_range_file_diff":
      return (empty ? EMPTY_DIFF : TEXT_DIFF) as T;
    case "compare_range":
      return (
        empty
          ? { ...RANGE, commits: [], files: [], ahead: 0, behind: 0, mergeBase: RANGE.mergeBase }
          : RANGE
      ) as T;
    case "get_branches":
      return (
        empty
          ? []
          : MANY_BRANCHES.dossiers.map((d) => ({ name: d.name, tip: d.tip, isHead: d.isHead }))
      ) as T;
    case "file_commit":
      return "filed-sha" as T;
    case "delete_local_branch":
    case "create_local_tag":
    case "delete_local_tag":
    case "push_tag":
    case "delete_remote_tag":
    case "github_logout":
    case "github_rerun_job":
    case "github_submit_review":
      return undefined as T;
    case "get_settings":
    case "set_settings":
      return (args?.settings as T) ?? (settings() as T);
    case "settings_toml_path":
      return "/archives/timestream/settings.toml" as T;
    case "github_login_begin":
      return (
        empty ? { ...DEVICE_BEGIN, clientIdConfigured: false, userCode: "" } : DEVICE_BEGIN
      ) as T;
    case "github_login_poll":
      return hang();
    case "github_login_pat":
    case "github_whoami":
      return (empty ? null : ANALYST) as T;
    case "list_remotes":
      return (empty ? [] : [ORIGIN]) as T;
    case "github_origin":
      return (empty ? null : ORIGIN) as T;
    case "ahead_behind":
    case "fetch_remote":
    case "push_branch":
    case "pull_ff_only":
      return (empty ? { ahead: 0, behind: 0, upstream: null } : SYNC) as T;
    case "list_ssh_keys":
      return (empty ? [] : SSH_KEYS) as T;
    case "ssh_agent_status":
    case "ssh_agent_ensure":
    case "ssh_add_key":
      return (empty ? AGENT_DOWN : AGENT_UP) as T;
    case "github_repo_features":
      return FEATURES as T;
    case "github_list_pulls":
      return (empty ? [] : PULLS) as T;
    case "github_list_pull_counts":
      return (empty ? { open: 0, closed: 0 } : PULL_COUNTS) as T;
    case "github_get_pull":
    case "github_create_pull":
    case "github_update_pull":
    case "github_merge_pull":
      return PULL as T;
    case "github_list_issues":
      return (empty ? [] : ISSUES) as T;
    case "github_create_issue":
    case "github_update_issue":
      return ISSUES[0] as T;
    case "github_list_issue_comments":
      return (empty ? [] : ISSUE_COMMENTS) as T;
    case "github_add_issue_comment":
      return ISSUE_COMMENTS[0] as T;
    case "github_list_releases":
      return (empty ? [] : RELEASES) as T;
    case "github_create_release":
    case "github_update_release":
      return RELEASES[0] as T;
    case "github_list_checks":
      return (empty ? [] : CHECKS) as T;
    case "github_list_review_comments":
      return (empty ? [] : REVIEW_COMMENTS) as T;
    case "github_list_pull_commits":
      return (empty ? [] : PULL_COMMITS) as T;
    case "github_list_reviews":
      return (empty ? [] : REVIEWS) as T;
    case "github_reply_review_comment":
      return REVIEW_COMMENTS[0] as T;
    case "github_list_notifications":
      return [] as T;
    case "github_search_repos":
      return (empty ? [] : SEARCH_HITS) as T;
    default:
      return undefined as T;
  }
}
