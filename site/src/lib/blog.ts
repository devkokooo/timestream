import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { AUTHOR_AVATAR, AUTHOR_HREF } from "./site";

/** Average adult reading pace for technical / blog prose. */
const WORDS_PER_MINUTE = 200;

export type BlogAuthor = {
  name: string;
  href: string;
  avatar: string;
};

/** Editorial fields only — dates and read time are derived automatically. */
export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  stamp: string;
  author: BlogAuthor;
  /**
   * Optional override for the first-publish date (`YYYY-MM-DD`).
   * When omitted, taken from the first git commit that added the page.
   */
  published?: string;
};

export type BlogPost = BlogPostMeta & {
  /** ISO date `YYYY-MM-DD` — first published */
  published: string;
  /** ISO date `YYYY-MM-DD` — last body change (git, or today if uncommitted) */
  updated: string;
  /** Estimated minutes to read (from post body; memoized by content hash) */
  readMinutes: number;
};

const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "v0.1",
    title: "Initial release",
    description:
      "First public working release of Timestream, a local-first TVA-styled Git client with GitHub integration. Cross-platform and open-sourced under AGPL-3.0.",
    stamp: "v0.1",
    author: {
      name: "DevKokooo",
      href: AUTHOR_HREF,
      avatar: AUTHOR_AVATAR,
    },
    published: "2026-08-18",
  },
];

/** In-process memo: same body hash → same minutes (no recount). */
const readMinutesByHash = new Map<string, number>();
const hydrateMemo = new Map<string, BlogPost>();

function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

function findSiteRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "pages", "blog"))) return cwd;
  const nested = join(cwd, "site");
  if (existsSync(join(nested, "src", "pages", "blog"))) return nested;
  return cwd;
}

const REPO_ROOT = findRepoRoot();
const SITE_ROOT = findSiteRoot();

/** Strip frontmatter / markup so word count reflects readable prose. */
export function plainTextFromSource(source: string): string {
  return source
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(source: string): number {
  const text = plainTextFromSource(source);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

/** Stable short hash of readable body text. */
export function bodyHash(source: string): string {
  return createHash("sha256").update(plainTextFromSource(source)).digest("hex").slice(0, 16);
}

/**
 * Estimate reading time from post source (Astro/HTML/Markdown/plain text).
 * Ceiling so a short dispatch is still at least 1 minute.
 */
export function estimateReadMinutes(
  source: string,
  wordsPerMinute: number = WORDS_PER_MINUTE,
): number {
  const words = countWords(source);
  if (words === 0) return 1;
  return Math.max(1, Math.ceil(words / Math.max(1, wordsPerMinute)));
}

function postSourcePath(slug: string): string {
  return join(SITE_ROOT, "src", "pages", "blog", `${slug}.astro`);
}

function postRepoRelPath(slug: string): string {
  return join("site", "src", "pages", "blog", `${slug}.astro`).replace(/\\/g, "/");
}

export function readPostSource(slug: string): string {
  return readFileSync(postSourcePath(slug), "utf8");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mtimeIso(slug: string): string {
  return new Date(statSync(postSourcePath(slug)).mtimeMs).toISOString().slice(0, 10);
}

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Commit dates for a path, newest first (`YYYY-MM-DD`). */
function gitCommitDates(slug: string): string[] {
  const out = git(["log", "--follow", "--format=%cs", "--", postRepoRelPath(slug)]);
  if (!out) return [];
  return [...new Set(out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function gitIsDirty(slug: string): boolean {
  const out = git(["status", "--porcelain", "--", postRepoRelPath(slug)]);
  return Boolean(out && out.length > 0);
}

/**
 * published = first commit that touched the page (or meta override / mtime).
 * updated = latest commit, or today if the working tree has uncommitted edits.
 */
export function resolvePostDates(
  slug: string,
  publishedOverride?: string,
): { published: string; updated: string } {
  const dates = gitCommitDates(slug);
  const dirty = gitIsDirty(slug);
  const fallback = mtimeIso(slug);

  const published = publishedOverride ?? dates.at(-1) ?? fallback;
  const updated = dirty ? todayIso() : (dates[0] ?? fallback);

  if (updated < published) return { published, updated: published };
  return { published, updated };
}

/** Read minutes for a slug; recounts only when the body hash is new to this process. */
export function resolveReadMinutes(slug: string): number {
  const source = readPostSource(slug);
  const hash = bodyHash(source);
  const cached = readMinutesByHash.get(hash);
  if (cached !== undefined) return cached;
  const minutes = estimateReadMinutes(source);
  readMinutesByHash.set(hash, minutes);
  return minutes;
}

function hydrate(meta: BlogPostMeta): BlogPost {
  const source = readPostSource(meta.slug);
  const hash = bodyHash(source);
  const dirty = gitIsDirty(meta.slug);
  const memoKey = `${meta.slug}:${hash}:${dirty ? "dirty" : "clean"}:${meta.published ?? ""}`;
  const memoized = hydrateMemo.get(memoKey);
  if (memoized) return memoized;

  const { published, updated } = resolvePostDates(meta.slug, meta.published);
  const readMinutes = resolveReadMinutes(meta.slug);
  const post: BlogPost = {
    ...meta,
    published,
    updated,
    readMinutes,
  };
  hydrateMemo.set(memoKey, post);
  return post;
}

/** Newest first (by last update, then published). */
export function listBlogPosts(): BlogPost[] {
  return BLOG_POSTS.map(hydrate).sort((a, b) => {
    const byUpdated = b.updated.localeCompare(a.updated);
    if (byUpdated !== 0) return byUpdated;
    return b.published.localeCompare(a.published);
  });
}

export function getBlogPost(slug: string): BlogPost | undefined {
  const meta = BLOG_POSTS.find((post) => post.slug === slug);
  return meta ? hydrate(meta) : undefined;
}

export function formatBlogDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Published date, plus "Updated …" when the body was revised later. */
export function formatPostDates(post: Pick<BlogPost, "published" | "updated">): string {
  const published = formatBlogDate(post.published);
  if (post.updated === post.published) return published;
  return `${published} · Updated ${formatBlogDate(post.updated)}`;
}

export function readTimeLabel(minutes: number): string {
  const n = Math.max(1, Math.round(minutes));
  return `${n} min read`;
}

export function postWasUpdated(post: Pick<BlogPost, "published" | "updated">): boolean {
  return post.updated !== post.published;
}
