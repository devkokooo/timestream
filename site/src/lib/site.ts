export const GITHUB_REPO = "https://github.com/devkokooo/timestream";

/** Short CTA stamp from a full git tag (`v0.2.0` → `v0.2`). */
export function releaseLabel(tag: string): string {
  return tag.replace(/\.0$/, "");
}

export function releaseHref(tag: string): string {
  return `${GITHUB_REPO}/releases/tag/${tag}`;
}

export const RELEASE_TAG = "v0.2.1";
export const RELEASE_HREF = releaseHref(RELEASE_TAG);
/** Short stamp for CTAs (`v0.2.0` → `v0.2`). */
export const RELEASE_LABEL = releaseLabel(RELEASE_TAG);
export const LICENSE_HREF = `${GITHUB_REPO}/blob/sacred/LICENSE`;
export const GITHUB_PROFILE = "https://github.com/devkokooo";
export const X_HREF = "https://x.com/devkokooo";
export const DISCORD_HREF = "https://discord.gg/J3EPsBhKDG";
export const AUTHOR_HREF = "https://devkoko.com";
export const AUTHOR_AVATAR = "/author-avatar.jpg";
export const ORG_HREF = "https://forgeware.dev";
export const SUPPORT_HREF = `${GITHUB_REPO}/issues`;
export const ANNOUNCEMENT_HREF = "/blog/v0.2/";
export const SITE_TITLE = "Timestream VCS";
export const SITE_DESCRIPTION =
  "A local-first TVA-styled Git client with GitHub integration. Traverse your commit history on the timeline, review diffs, push over SSH, and open pull requests from GitHub.";
export const SITE_OG_IMAGE = "/og.png";
export const SITE_OG_WIDTH = 2400;
export const SITE_OG_HEIGHT = 1260;
export const SITE_OG_ALT =
  "Timestream review desk showing a split diff of graph.rs, with unfiled and staged files beside the hunk.";
export const X_HANDLE = "@devkokooo";
