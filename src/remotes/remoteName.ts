const ILLEGAL = /[\x00-\x20\x7f~^:?*[\\]/;

export function remoteNameError(
  raw: string,
  taken: Iterable<string>,
  opts?: { renaming?: string },
): string | null {
  const name = raw.trim();
  if (!name) return "Name is required.";
  if (name === "HEAD" || name.toLowerCase() === "head") return "HEAD is reserved.";
  if (name.startsWith("-")) return "Name cannot start with '-'.";
  if (name.includes("..")) return "Name cannot contain '..'.";
  if (name.includes("@{")) return "Name cannot contain '@{'.";
  if (name === "@") return "Name cannot be '@'.";
  if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) {
    return "Name cannot start, end, or repeat '/'.";
  }
  if (name.endsWith(".")) return "Name cannot end with a dot.";
  if (ILLEGAL.test(name)) return "Name contains an illegal character.";
  for (const part of name.split("/")) {
    if (!part) return "Name cannot contain an empty path segment.";
    if (part.startsWith(".")) return "A path segment cannot start with a dot.";
    if (part.endsWith(".lock")) return "A path segment cannot end with '.lock'.";
  }
  const ignore = opts?.renaming;
  for (const existing of taken) {
    if (existing === name && existing !== ignore) return `Remote '${name}' already exists.`;
  }
  return null;
}

export function remoteUrlError(raw: string): string | null {
  if (!raw.trim()) return "URL is required.";
  return null;
}

export function pickSelectedRemote(names: string[], current: string | null): string | null {
  if (current && names.includes(current)) return current;
  if (names.includes("origin")) return "origin";
  return names[0] ?? null;
}
