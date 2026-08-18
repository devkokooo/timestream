import {
  AGENT_UP,
  fileDiffFor,
  PR2_RANGE,
  SSH_KEYS,
  tourCommitDetail,
} from "../lib/tourData";

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case "list_ssh_keys":
      return SSH_KEYS as T;
    case "ssh_agent_status":
    case "ssh_agent_ensure":
    case "ssh_add_key":
      return AGENT_UP as T;
    case "compare_range":
      return PR2_RANGE as T;
    case "get_range_file_diff":
    case "get_file_diff":
    case "get_worktree_diff":
      return fileDiffFor(String(args?.rel ?? "src/lib/graph.rs")) as T;
    case "get_commit":
      return tourCommitDetail(String(args?.sha ?? "")) as T;
    default:
      return undefined as T;
  }
}
