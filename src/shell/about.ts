/** Support links and stack labels for the About dialog (desktop; not imported from site/). */

export const GITHUB_REPO = "https://github.com/devkokooo/timestream";
export const SUPPORT_HREF = `${GITHUB_REPO}/issues`;
export const LICENSE_HREF = `${GITHUB_REPO}/blob/sacred/LICENSE`;
export const DISCORD_HREF = "https://discord.gg/J3EPsBhKDG";

export const LICENSE_LABEL = "AGPL-3.0-or-later";
export const GIT2_LABEL = "git2 0.20 (vendored libgit2 + OpenSSL)";

/** Prefer the nightly bake from `bundle-release.ts`; otherwise the Tauri runtime version. */
export function resolveAppVersion(runtimeVersion: string): string {
  const baked = import.meta.env.VITE_TIMESTREAM_APP_VERSION;
  if (typeof baked === "string" && baked.length > 0) return baked;
  return runtimeVersion;
}
