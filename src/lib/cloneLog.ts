const PHASE_PREFIXES = [
  "Receiving objects:",
  "Resolving deltas:",
  "Checking out files:",
] as const;

const MAX_LINES = 400;

export function appendCloneLog(lines: string[], next: string, max = MAX_LINES): string[] {
  const phase = PHASE_PREFIXES.find((prefix) => next.startsWith(prefix));
  const last = lines.at(-1);
  const out =
    phase && last?.startsWith(phase) ? [...lines.slice(0, -1), next] : [...lines, next];
  return out.length > max ? out.slice(-max) : out;
}
