# 🕰️ Timestream
A local-first TVA-styled Git client with GitHub integration.

<img width="1918" height="1033" alt="image" src="https://github.com/user-attachments/assets/42582399-9ec8-4f67-ba53-d63e0fd931ce" />

## Stack

Tauri 2 + React + TypeScript. Git via libgit2 (`git2`), never a `git` subprocess.

## Run

```
bun install
bun run tauri dev
```

Requires Bun, Rust, and Windows C++ build tools (or the platform equivalent).

## Sign in with GitHub

Primary sign-in is a GitHub App device flow. Tokens (and refresh tokens) live in the OS keychain, never in `settings.toml`.

1. [Register a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app). In the app settings, check **Enable Device Flow** (Device Authorization Grant) and save. Sign-in returns 400 until this is on. Do not ship a client secret.
2. Grant **only** these permissions: Contents, Pull requests, Issues, Actions, and Workflows (read and write); Checks and Members (read); Metadata (automatic). Email addresses (read) is optional.
3. Install the app on the user or organization whose repositories Timestream should see.
4. Build with `TIMESTREAM_GITHUB_CLIENT_ID` set to the app’s **client ID** (not the app ID).
5. In Timestream, click **Sign in with GitHub**, then enter the device code at GitHub.

### Personal access token (fallback)

If the client ID is not configured, paste a token instead. A classic PAT covers every Timestream GitHub feature.

1. Open [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens/new?description=Timestream&scopes=repo,workflow,read:org).
2. Name it `Timestream`, set an expiry, and enable **only** these scopes:
   - **`repo`** (read and write) — HTTPS clone / fetch / push, pull requests, reviews, issues, comments, releases, check runs, notification inbox
   - **`workflow`** (read and write) — push workflow files; rerun Actions jobs
   - **`read:org`** (read) — search organization repositories
3. Generate the token, copy it, and paste it into Timestream’s sign-in dialog.

Fine-grained tokens work for clone, PRs, issues, releases, and Actions if you grant **Read and write** on Contents, Pull requests, Issues, Actions, and Workflows (Metadata read is automatic; Members read if you need org repos). GitHub’s Checks API and some notification endpoints still require a classic token, so prefer classic unless you are restricting the token to specific repositories.

## Test

```
cargo test --manifest-path src-tauri/Cargo.toml
bun run test
bunx tsc --noEmit
bunx vite build --config vite.gallery.config.ts
bun run gallery
```

`bun run test` and `cargo test` cover graph math, git fixtures, and view-model layout. `bunx tsc --noEmit` catches broken slice imports. The gallery production build compiles exhibits against production components. `bun run gallery` is the visual UI suite: a TVA Specimen Desk at http://localhost:1422 (port 1420 stays reserved for `tauri dev`). Open each surface in SUCCESS / LOADING / ERROR / EMPTY without Tauri or a real repo. Bookmark a state with `#/welcome-gate/error`.

Fixtures cover linear history, many simultaneous branches, and branches that diverge for dozens of commits.

## Release

`bun run bundle:release` builds the installer for **this OS only** (Tauri cannot cross-compile):

| Host    | Artifact    |
|---------|-------------|
| Windows | NSIS `.exe` |
| Linux   | AppImage    |
| macOS   | DMG         |

Output lands in `release/` with `SHA256SUMS`. Pass `--skip-tests` to skip Vitest/Cargo, `--out <dir>` to change the destination.

To ship all three, push a version tag (`v0.1.0`) or run **Actions → Release → Run workflow** and enter that tag. Both build Windows NSIS, Linux AppImage, and macOS arm64 + x64 DMGs, then open a draft GitHub release on the tag (created on the workflow SHA if it does not exist yet). Set the `TIMESTREAM_GITHUB_CLIENT_ID` repository secret so the GitHub App client ID is baked in.

Bump `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` together — the script refuses a mismatch.

## Marketing site

Separate Astro app in `site/`, deployed on Netlify. Set the site’s **Base directory** to `site` in the Netlify UI (do not also set `base` in `netlify.toml` — that resolves to `site/site`). Config lives in `site/netlify.toml`. Not bundled into the Tauri app.

```
cd site
bun install
bun run dev
```

Opens at http://localhost:4321. Primary CTA is Get v0.1, with supported platforms listed underneath, linking to the GitHub release.

Tour diffs use **baked** syntax tokens (no Shiki in the browser). After editing hunk fixtures in `site/src/lib/tourData.ts`:

```
cd site && bun run bake:tokens
```

Commit the updated `site/src/lib/tourTokens.generated.ts`. Details: `site/README.md`.

## Design

See `src/` and `src-tauri/src/` for the feature map (timeline, worktree, remotes, ssh, auth, github, …). Design tokens live in `src/ui/styles/`. See `AGENTS.md`.

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
