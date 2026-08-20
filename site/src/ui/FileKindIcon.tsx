import type { IconType } from "react-icons";
import { VscFile, VscFileText } from "react-icons/vsc";
import { SiCss, SiReact, SiRust, SiTypescript } from "react-icons/si";
import { cn } from "../../../src/ui/cn";
import { fileKindFromPath } from "../../../src/diff/fileKind";

/**
 * Tour-scoped icon map for the marketing site.
 * The desktop `FileKindIcon` pulls the full react-icons/si catalog (~100 KiB);
 * the WorkPath fixtures only need a handful of kinds.
 */
interface Spec {
  Icon: IconType;
  color: string;
  label: string;
}

const FILE: Spec = { Icon: VscFile, color: "#E8B86D", label: "File" };

const ICONS: Record<string, Spec> = {
  react: { Icon: SiReact, color: "#61DAFB", label: "React" },
  typescript: { Icon: SiTypescript, color: "#3178C6", label: "TypeScript" },
  rust: { Icon: SiRust, color: "#DEA584", label: "Rust" },
  css: { Icon: SiCss, color: "#663399", label: "CSS" },
  text: { Icon: VscFileText, color: "#F5E6C8", label: "Text" },
  file: FILE,
};

export function FileKindIcon({
  path,
  className,
  color,
}: {
  path: string;
  className?: string;
  color?: string;
}) {
  const spec = ICONS[fileKindFromPath(path)] ?? FILE;
  const Icon = spec.Icon;
  return (
    <Icon
      className={cn("shrink-0", className)}
      size={14}
      color={color ?? spec.color}
      title={spec.label}
      aria-hidden
    />
  );
}
