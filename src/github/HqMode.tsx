import { useCallback, useEffect, useState } from "react";
import { githubRepoFeatures } from "@/github/api";
import { cn } from "@/ui/cn";
import { btn } from "@/ui/ui";
import type { HqTab, RepoFeatures } from "@/github/types";
import { dispatchMessage } from "@/github/dispatch";
import { TvaTerm } from "@/ui/TvaTerm";
import { HqClearance, TabBtn } from "@/github/hqChrome";
import type { FeatureDesk, HqModeProps } from "@/github/hqTypes";
import { RequestsPanel } from "@/github/pulls/RequestsPanel";
import { IncidentsPanel } from "@/github/issues/IncidentsPanel";
import { CanonPanel } from "@/github/releases/CanonPanel";

export type { HqModeProps } from "@/github/hqTypes";

export function HqMode(props: HqModeProps) {
  const [tabState, setTabState] = useState<HqTab>("requests");
  const tab = props.tab ?? tabState;
  const setTab = (next: HqTab) => {
    props.onTab?.(next);
    if (props.tab === undefined) setTabState(next);
  };
  const [features, setFeatures] = useState<RepoFeatures | null>(null);
  const [recheckingFeatures, setRecheckingFeatures] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);

  const recheckFeatures = useCallback(async () => {
    if (!props.signedIn || !props.owner || !props.repoName) {
      setFeatures(null);
      setRecheckError(null);
      return;
    }
    setRecheckingFeatures(true);
    setRecheckError(null);
    try {
      setFeatures(await githubRepoFeatures(props.owner, props.repoName));
    } catch (err) {
      setRecheckError(dispatchMessage(err));
    } finally {
      setRecheckingFeatures(false);
    }
  }, [props.signedIn, props.owner, props.repoName]);

  useEffect(() => {
    void recheckFeatures();
  }, [recheckFeatures]);

  const featureDesk: FeatureDesk = {
    features,
    onRecheckFeatures: () => void recheckFeatures(),
    recheckingFeatures,
    recheckError,
  };

  return (
    <div data-workspace className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#16120e]">
      <div className="flex shrink-0 items-stretch border-b border-tva-gold/16 bg-[#1b1713]">
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} flavor="Requests" noun="Pull requests" />
        <TabBtn active={tab === "incidents"} onClick={() => setTab("incidents")} flavor="Incidents" noun="Issues" />
        <TabBtn active={tab === "canon"} onClick={() => setTab("canon")} flavor="Canon" noun="Releases" />
        {props.signedIn ? (
          <button
            type="button"
            className={cn(btn, "mx-2 my-1.5 shrink-0 self-center")}
            onClick={props.onSignOut}
            title="Sign out of GitHub"
          >
            <TvaTerm flavor="Revoke clearance" noun="Sign out" />
          </button>
        ) : null}
      </div>
      {props.signedIn ? (
        <>
          {tab === "requests" ? <RequestsPanel {...props} {...featureDesk} /> : null}
          {tab === "incidents" ? <IncidentsPanel {...props} {...featureDesk} /> : null}
          {tab === "canon" ? <CanonPanel {...props} /> : null}
        </>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="border-r border-tva-gold/16 bg-[#1b1713]" />
          <div className="flex min-h-0 min-w-0 flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e] px-6">
            <HqClearance onSignIn={props.onSignIn} />
          </div>
          <aside className="border-l border-tva-gold/16 bg-[#16120e]" />
        </div>
      )}
    </div>
  );
}
