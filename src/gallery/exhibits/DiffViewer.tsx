import { DiffViewer } from "../../components/DiffViewer";
import { BINARY_DIFF, EMPTY_DIFF, FILES, REVIEW_COMMENTS, TEXT_DIFF } from "../fixtures";
import { Frame, noop, noopAsync } from "../frame";
import { SPECIMEN_ERROR, type Scenario } from "../scenario";

export function DiffViewerExhibit({ scenario }: { scenario: Scenario }) {
  const file = FILES[0];
  const diff =
    scenario === "loading"
      ? null
      : scenario === "empty"
        ? EMPTY_DIFF
        : scenario === "error"
          ? BINARY_DIFF
          : TEXT_DIFF;
  return (
    <Frame>
      <DiffViewer
        file={file}
        diff={scenario === "error" ? null : diff}
        mode="split"
        error={scenario === "error" ? SPECIMEN_ERROR : null}
        onMode={noop}
        onClose={noop}
        onFile={noopAsync}
        reviewComments={scenario === "success" ? REVIEW_COMMENTS : undefined}
      />
    </Frame>
  );
}
