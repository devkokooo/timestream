import type { ReactNode } from "react";
import { AuthDialogExhibit } from "./exhibits/AuthDialog";
import { BureauHeaderExhibit } from "./exhibits/BureauHeader";
import {
  FileKindIconExhibit,
  PersonNameExhibit,
  RailStripExhibit,
  TransmitButtonExhibit,
  TvaJumbleExhibit,
  TvaSkeletonExhibit,
  TvaTermExhibit,
} from "./exhibits/chrome";
import { CommandPaletteExhibit } from "./exhibits/CommandPalette";
import { DiffViewerExhibit } from "./exhibits/DiffViewer";
import { DocketExhibit } from "./exhibits/Docket";
import { HqClearanceExhibit, HqModeExhibit } from "./exhibits/HqMode";
import { IdentityPickerExhibit } from "./exhibits/IdentityPicker";
import { NexusDossierExhibit, NexusTooltipExhibit } from "./exhibits/Nexus";
import { PrCompareExhibit } from "./exhibits/PrCompare";
import { HistoryRailExhibit, LeftRailExhibit, TagsRailExhibit, VariantRailExhibit } from "./exhibits/rails";
import { ReviewModeExhibit } from "./exhibits/ReviewMode";
import { SacredTimelineExhibit } from "./exhibits/SacredTimeline";
import { SettingsPageExhibit } from "./exhibits/SettingsPage";
import { StatusBarExhibit } from "./exhibits/StatusBar";
import { TitleBarExhibit } from "./exhibits/TitleBar";
import { WelcomeGateExhibit } from "./exhibits/WelcomeGate";
import { SCENARIOS, type Scenario } from "./scenario";

export interface Exhibit {
  id: string;
  title: string;
  group: string;
  stamps: readonly Scenario[];
  render: (scenario: Scenario) => ReactNode;
}

const ALL = SCENARIOS;
const NO_IPC = ["success", "empty"] as const;
const LOCAL = ["success", "loading", "empty"] as const;

export const EXHIBITS: Exhibit[] = [
  {
    id: "transmit-button",
    title: "Transmit button",
    group: "Chrome",
    stamps: ["success", "loading", "empty"],
    render: (scenario) => <TransmitButtonExhibit scenario={scenario} />,
  },
  {
    id: "tva-skeleton",
    title: "Skeleton",
    group: "Chrome",
    stamps: ["success"],
    render: () => <TvaSkeletonExhibit />,
  },
  {
    id: "tva-jumble",
    title: "Jumble",
    group: "Chrome",
    stamps: ["success"],
    render: () => <TvaJumbleExhibit />,
  },
  {
    id: "tva-term",
    title: "Term",
    group: "Chrome",
    stamps: ["success"],
    render: () => <TvaTermExhibit />,
  },
  {
    id: "file-kind-icon",
    title: "File kind icon",
    group: "Chrome",
    stamps: ["success"],
    render: () => <FileKindIconExhibit />,
  },
  {
    id: "person-name",
    title: "Person name",
    group: "Chrome",
    stamps: ["success"],
    render: () => <PersonNameExhibit />,
  },
  {
    id: "rail-strip",
    title: "Rail strip",
    group: "Chrome",
    stamps: ["success"],
    render: () => <RailStripExhibit />,
  },
  {
    id: "command-palette",
    title: "Command palette",
    group: "Chrome",
    stamps: NO_IPC,
    render: (scenario) => <CommandPaletteExhibit scenario={scenario} />,
  },
  {
    id: "title-bar",
    title: "Title bar",
    group: "Chrome",
    stamps: NO_IPC,
    render: (scenario) => <TitleBarExhibit scenario={scenario} />,
  },
  {
    id: "bureau-header",
    title: "Bureau header",
    group: "Chrome",
    stamps: ["success", "loading", "empty"],
    render: (scenario) => <BureauHeaderExhibit scenario={scenario} />,
  },
  {
    id: "status-bar",
    title: "Status bar",
    group: "Chrome",
    stamps: ["success", "loading", "error", "empty"],
    render: (scenario) => <StatusBarExhibit scenario={scenario} />,
  },
  {
    id: "welcome-gate",
    title: "Welcome gate",
    group: "Local",
    stamps: ALL,
    render: (scenario) => <WelcomeGateExhibit scenario={scenario} />,
  },
  {
    id: "sacred-timeline",
    title: "Sacred Timeline",
    group: "Local",
    stamps: ["success", "loading", "empty"],
    render: (scenario) => <SacredTimelineExhibit scenario={scenario} />,
  },
  {
    id: "variant-rail",
    title: "Variant rail",
    group: "Local",
    stamps: ["success", "loading", "empty"],
    render: (scenario) => <VariantRailExhibit scenario={scenario} />,
  },
  {
    id: "history-rail",
    title: "History rail",
    group: "Local",
    stamps: NO_IPC,
    render: (scenario) => <HistoryRailExhibit scenario={scenario} />,
  },
  {
    id: "tags-rail",
    title: "Tags rail",
    group: "Local",
    stamps: NO_IPC,
    render: (scenario) => <TagsRailExhibit scenario={scenario} />,
  },
  {
    id: "left-rail",
    title: "Left rail",
    group: "Local",
    stamps: LOCAL,
    render: (scenario) => <LeftRailExhibit scenario={scenario} />,
  },
  {
    id: "docket",
    title: "Docket / case file",
    group: "Local",
    stamps: LOCAL,
    render: (scenario) => <DocketExhibit scenario={scenario} />,
  },
  {
    id: "diff-viewer",
    title: "Diff viewer",
    group: "Local",
    stamps: ALL,
    render: (scenario) => <DiffViewerExhibit scenario={scenario} />,
  },
  {
    id: "review-mode",
    title: "Review mode",
    group: "Local",
    stamps: ["success", "loading", "error", "empty"],
    render: (scenario) => <ReviewModeExhibit scenario={scenario} />,
  },
  {
    id: "nexus-tooltip",
    title: "Nexus tooltip",
    group: "Local",
    stamps: ["success", "error", "empty"],
    render: (scenario) => <NexusTooltipExhibit scenario={scenario} />,
  },
  {
    id: "nexus-dossier",
    title: "Nexus dossier",
    group: "Local",
    stamps: ALL,
    render: (scenario) => <NexusDossierExhibit scenario={scenario} />,
  },
  {
    id: "auth-dialog",
    title: "Auth dialog",
    group: "GitHub",
    stamps: ALL,
    render: () => <AuthDialogExhibit />,
  },
  {
    id: "identity-picker",
    title: "Identity picker",
    group: "GitHub",
    stamps: ALL,
    render: () => <IdentityPickerExhibit />,
  },
  {
    id: "hq-mode",
    title: "HQ desk",
    group: "GitHub",
    stamps: ALL,
    render: () => <HqModeExhibit />,
  },
  {
    id: "hq-clearance",
    title: "HQ clearance",
    group: "GitHub",
    stamps: ["success"],
    render: () => <HqClearanceExhibit />,
  },
  {
    id: "pr-compare",
    title: "PR compare",
    group: "GitHub",
    stamps: ALL,
    render: () => <PrCompareExhibit />,
  },
  {
    id: "settings-page",
    title: "Settings",
    group: "GitHub",
    stamps: ALL,
    render: (scenario) => <SettingsPageExhibit scenario={scenario} />,
  },
];

export function exhibitById(id: string): Exhibit | undefined {
  return EXHIBITS.find((item) => item.id === id);
}
