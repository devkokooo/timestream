# 🕰️ Timestream
A post-modern Git client, visualized TVA-style

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
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
bun run gallery
```

`bun run test` and `cargo test` cover graph math, git fixtures, and view-model layout. `bun run gallery` is the visual UI suite: a TVA Specimen Desk at http://localhost:1422 (port 1420 stays reserved for `tauri dev`). Open each surface in SUCCESS / LOADING / ERROR / EMPTY without Tauri or a real repo. Bookmark a state with `#/welcome-gate/error`.

Fixtures cover linear history, many simultaneous branches, and branches that diverge for dozens of commits.

## Marketing site

Separate Astro app in `site/`, deployed on Netlify. Set the site’s **Base directory** to `site` in the Netlify UI (do not also set `base` in `netlify.toml` — that resolves to `site/site`). Config lives in `site/netlify.toml`. Not bundled into the Tauri app.

```
cd site
bun install
bun run dev
```

Opens at http://localhost:4321. Primary CTA is GitHub — no download buttons in v0.1.

## Design

Orange tile, board-formed concrete, sacred gold veining, manila dossiers, analog grain. See `AGENTS.md`.

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
