export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function sameJson<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function keepIfSame<T>(prev: T, next: T): T {
  return sameJson(prev, next) ? prev : next;
}

export function cloneUrl(input: string, protocol: string): string {
  const githubHttps = input.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (protocol === "ssh" && githubHttps) {
    return `git@github.com:${githubHttps[1]}/${githubHttps[2].replace(/\.git$/i, "")}.git`;
  }
  if (input.includes("://") || input.startsWith("git@")) return input;
  const [owner, name] = input.split("/");
  if (owner && name) {
    return protocol === "ssh"
      ? `git@github.com:${owner}/${name}.git`
      : `https://github.com/${owner}/${name}.git`;
  }
  return input;
}
