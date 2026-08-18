import { BureauHeader } from "../../components/BureauHeader";
import { ANALYST, ORIGIN, REPO } from "../fixtures";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function BureauHeaderExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame>
      <BureauHeader
        repo={REPO}
        origin={scenario === "empty" ? null : ORIGIN}
        anomalyCount={scenario === "success" ? 3 : 0}
        anomalyLoading={scenario === "loading"}
        reviewOpen={false}
        onToggleReview={noop}
        user={scenario === "empty" ? null : ANALYST}
        hqOpen={false}
        onToggleHq={noop}
      />
    </Frame>
  );
}
