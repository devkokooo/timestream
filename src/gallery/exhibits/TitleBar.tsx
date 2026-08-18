import { TitleBar } from "../../components/TitleBar";
import { Frame, noop } from "../frame";
import type { Scenario } from "../scenario";

export function TitleBarExhibit({ scenario }: { scenario: Scenario }) {
  return (
    <Frame>
      <TitleBar
        title={scenario === "empty" ? "TIMESTREAM — Chronomonitoring" : "timestream — main"}
        folderOpen={scenario !== "empty"}
        onNewWindow={noop}
        onOpenFolder={noop}
        onCloseFolder={noop}
        onRescan={noop}
        onSettings={noop}
      />
    </Frame>
  );
}
