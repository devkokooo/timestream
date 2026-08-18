import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { Scenario } from "./scenario";

export function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#161310]", className)}>
      {children}
    </div>
  );
}

export function Pad({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">{children}</div>;
}

export function noop(): void {}
export async function noopAsync(): Promise<void> {}

export type ExhibitRender = (scenario: Scenario) => ReactNode;
