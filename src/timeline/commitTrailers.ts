export type TrailerRole = "coauthor" | "signer" | "reviewer" | "tester" | "other";

export interface Trailer {
  key: string;
  value: string;
  name: string;
  email: string | null;
  role: TrailerRole;
}

export interface TrailerGroups {
  narrative: string;
  trailers: Trailer[];
  coauthors: Trailer[];
  signers: Trailer[];
  reviewers: Trailer[];
  testers: Trailer[];
  others: Trailer[];
}

const ROLE_BY_KEY: Record<string, TrailerRole> = {
  "co-authored-by": "coauthor",
  "signed-off-by": "signer",
  "reviewed-by": "reviewer",
  "acked-by": "reviewer",
  "tested-by": "tester",
};

const TRAILER_LINE = /^([A-Za-z0-9-]+):\s+(\S.*)$/;

export function roleForKey(key: string): TrailerRole | null {
  const k = key.toLowerCase();
  if (ROLE_BY_KEY[k]) return ROLE_BY_KEY[k];
  if (k.endsWith("-by") || k === "cc") return "other";
  return null;
}

export function parsePerson(value: string): { name: string; email: string | null } {
  const angled = value.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const email = angled[2].trim();
    const name = angled[1].trim();
    return { name: name || email, email };
  }
  const trimmed = value.trim();
  if (trimmed.includes("@") && !trimmed.includes(" ")) return { name: trimmed, email: trimmed };
  return { name: trimmed, email: null };
}

function parseTrailerLine(line: string): Trailer | null {
  const match = line.match(TRAILER_LINE);
  if (!match) return null;
  const role = roleForKey(match[1]);
  if (!role) return null;
  const value = match[2].trim();
  const person = parsePerson(value);
  return { key: match[1], value, name: person.name, email: person.email, role };
}

/** Split a commit body into narrative prose and a trailing git trailer block. */
export function parseCommitBody(body: string): TrailerGroups {
  const raw = body.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  if (!raw) {
    return emptyGroups("");
  }
  const lines = raw.split("\n");
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;

  const trailers: Trailer[] = [];
  let cursor = end;
  while (cursor > 0) {
    const line = lines[cursor - 1];
    if (line.trim() === "") {
      if (trailers.length === 0) {
        cursor--;
        continue;
      }
      break;
    }
    const trailer = parseTrailerLine(line);
    if (!trailer) break;
    trailers.push(trailer);
    cursor--;
  }
  trailers.reverse();

  if (trailers.length === 0) {
    return emptyGroups(raw);
  }

  let narrativeEnd = cursor;
  while (narrativeEnd > 0 && lines[narrativeEnd - 1].trim() === "") narrativeEnd--;
  const narrative = lines.slice(0, narrativeEnd).join("\n").trim();
  return groupTrailers(narrative, trailers);
}

function emptyGroups(narrative: string): TrailerGroups {
  return groupTrailers(narrative, []);
}

function groupTrailers(narrative: string, trailers: Trailer[]): TrailerGroups {
  return {
    narrative,
    trailers,
    coauthors: trailers.filter((t) => t.role === "coauthor"),
    signers: trailers.filter((t) => t.role === "signer"),
    reviewers: trailers.filter((t) => t.role === "reviewer"),
    testers: trailers.filter((t) => t.role === "tester"),
    others: trailers.filter((t) => t.role === "other"),
  };
}

export function formatPerson(name: string, email: string | null | undefined): string {
  if (email && email !== name) return `${name} · ${email}`;
  return name;
}
