import { HqMode } from "@/github/HqMode";
import { RequestsPanel } from "@/github/pulls/RequestsPanel";
import { IncidentsPanel } from "@/github/issues/IncidentsPanel";
import { CanonPanel } from "@/github/releases/CanonPanel";
import type { HqModeProps } from "@/github/hqTypes";
import type { RequestDeskTab } from "@/github/pulls/PrCompare";
import type { HqTab } from "@/github/types";
import { MANY_BRANCHES, REPO } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import { useExhibitTab } from "../exhibitUi";

const HQ: Omit<HqModeProps, "tab" | "onTab" | "deskTab" | "onDeskTab" | "signedIn"> = {
  owner: "tva",
  repoName: "timestream",
  onSignIn: noop,
  onSignOut: noop,
  repoPath: REPO.path,
  currentBranch: "feature",
  sacredBranch: "main",
  timeline: MANY_BRANCHES,
  onCheckoutPr: noopAsync,
  onSyncAfterMerge: noopAsync,
  selectedSha: MANY_BRANCHES.head,
};

const FEATURES = {
  features: {
    hasIssues: true,
    hasPullRequests: true,
    archived: false,
    htmlUrl: "https://github.com/tva/timestream",
  },
  onRecheckFeatures: noop,
  recheckingFeatures: false,
  recheckError: null,
};

export function HqModeExhibit() {
  const [tab, onTab] = useExhibitTab<HqTab>("hq-mode", "requests");
  const [deskTab, onDeskTab] = useExhibitTab<RequestDeskTab>("hq-mode-desk", "conversation");
  return (
    <Frame>
      <HqMode
        {...HQ}
        signedIn
        tab={tab}
        onTab={onTab}
        deskTab={deskTab}
        onDeskTab={onDeskTab}
      />
    </Frame>
  );
}

export function HqClearanceExhibit() {
  return (
    <Frame>
      <HqMode {...HQ} currentBranch="main" signedIn={false} />
    </Frame>
  );
}

export function GithubRequestsExhibit() {
  return (
    <Frame>
      <RequestsPanel {...HQ} signedIn {...FEATURES} />
    </Frame>
  );
}

export function GithubIncidentsExhibit() {
  return (
    <Frame>
      <IncidentsPanel {...HQ} signedIn {...FEATURES} />
    </Frame>
  );
}

export function GithubCanonExhibit() {
  return (
    <Frame>
      <CanonPanel {...HQ} signedIn />
    </Frame>
  );
}
