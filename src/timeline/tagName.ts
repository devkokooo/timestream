const ILLEGAL = /[\x00-\x20\x7f~^:?*[\\]/;

export function tagNameError(raw: string, taken: Iterable<string>): string | null {
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
  for (const existing of taken) {
    if (existing === name) return `Seal '${name}' already exists.`;
  }
  return null;
}

export function isValidTagName(name: string): boolean {
  return tagNameError(name, []) === null;
}
