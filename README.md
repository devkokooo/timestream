# 🕰️ Timestream
⏱️ Local-first Git client, visualized TVA-style

<img width="1367" height="926" alt="image" src="https://github.com/user-attachments/assets/2a2d9905-4fe3-4683-a876-dc0bd6a6e4d7" />

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
```

Fixtures cover linear history, many simultaneous branches, and branches that diverge for dozens of commits.

## Design

Orange tile, board-formed concrete, sacred gold veining, manila dossiers, analog grain. See `AGENTS.md`.
