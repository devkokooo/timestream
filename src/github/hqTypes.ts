import type { RequestDeskTab } from "@/github/pulls/PrCompare";
import type { HqTab, RepoFeatures } from "@/github/types";
import type { Timeline } from "@/timeline/types";

export interface HqModeProps {
  owner: string | null;
  repoName: string | null;
  signedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  repoPath: string | null;
  currentBranch: string | null;
  sacredBranch: string | null;
  timeline: Timeline | null;
  onCheckoutPr: (number: number) => void | Promise<void>;
  onSyncAfterMerge: (base: string) => void | Promise<void>;
  onCreateTag: (name: string, sha: string, message?: string) => void;
  onPushTag: (name: string) => void;
  selectedSha: string | null;
  tab?: HqTab;
  onTab?: (tab: HqTab) => void;
  deskTab?: RequestDeskTab;
  onDeskTab?: (tab: RequestDeskTab) => void;
}

export type FeatureDesk = {
  features: RepoFeatures | null;
  onRecheckFeatures: () => void;
  recheckingFeatures: boolean;
  recheckError: string | null;
};
