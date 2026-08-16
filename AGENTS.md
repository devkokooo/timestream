# Timestream — Agent Guide

Local-first Git client. The commit graph is rendered as a TVA Chronomonitor: a glowing Sacred Timeline with variant branches as spurs.

## Stack

- **Desktop:** Tauri 2 (Rust) + React 18 + TypeScript + Vite
- **Git:** `git2` (libgit2, vendored) — never shell out to `git` for product logic
- **Package manager:** Bun
- **Tests:** `cargo test` (graph + git fixtures) and `bun run test` (Vitest: view-model + layout)

## Layout

| Path | Role |
| --- | --- |
| `src-tauri/src/graph.rs` | Lane assignment, edges, branch topology. Pure. Heavily tested. |
| `src-tauri/src/git.rs` | Open repo, walk history, status, diff, checkout, stage, commit, tags |
| `src-tauri/src/remotes.rs` | libgit2 remotes, fetch, ff-only pull, push, clone, ahead/behind |
| `src-tauri/src/auth.rs` | GitHub App device flow + PAT; OS keychain |
| `src-tauri/src/ssh.rs` | SSH key listing, ssh-agent, ssh-add |
| `src-tauri/src/settings.rs` | Versioned `settings.toml` |
| `src-tauri/src/github.rs` | GitHub REST: PRs, issues, releases, checks, reviews |
| `src-tauri/src/commands.rs` | Tauri IPC surface — thin wrappers only |
| `src/lib/timelineView.ts` | Graph → SVG coordinates, lane spacing, label collision |
| `src/components/SacredTimeline.tsx` | Chronomonitor visualization |
| `src/styles/tva.css` | TVA tokens (orange, concrete, gold, analog grain) |

## Design language (Loki / TVA)

Do not look like GitHub, GitKraken, or a generic dark IDE.

- **Palette:** TVA orange (`#E85D04`), sacred gold (`#E8B86D` / `#F4C430`), board-formed concrete (`#2B2723`), cream paper (`#F5E6C8`), wood brown (`#5C4033`)
- **Timeline:** central gold-veined river; branches are variant spurs above/below; commits are nexus orbs
- **Chrome:** mid-century bureaucratic — dossier panels, stamps (`VARIANT`, `NEXUS`), CRT scanlines, analog grain. No cyan sci-fi glow
- **Type:** JetBrains Mono throughout (titles, UI, SHAs, metadata)

## Git rules

- Local-first working tree, plus optional GitHub remotes in v2 (clone / fetch / ff-only pull / push)
- Graph input is refs + reachable commits (local branches, tags, optional remote-tracking refs). Default branch is the Sacred Timeline; others are variants
- Layout must stay consistent for: linear history, many simultaneous branches, and branches that diverge for dozens of commits
- Never rewrite published history. Local amend of unpublished HEAD is allowed. No force-push. Checkout / stage / commit / amend unpublished HEAD / ff-only pull only
- Never shell out to `git`. OpenSSH `ssh-agent` / `ssh-add` are allowed (they are not git)
- Secrets (GitHub App tokens, PATs, SSH passphrases) live in the OS keychain, never in `settings.toml`

## GitHub App

Primary sign-in is a GitHub App user-to-server **device flow** (no client secret in the binary). Bake the public client ID at compile time with `TIMESTREAM_GITHUB_CLIENT_ID`. When you add a GitHub API, update this section, `README.md`, and the AuthDialog hint.

Register the app, enable **Device Authorization Grant**, and install it on each user or organization whose repos Timestream should see. User tokens only cover the intersection of the user's access and the app installation.

**App permissions** (lockstep with shipped features):

| Permission | Access | Used for |
| --- | --- | --- |
| Contents | Read and write | Clone, fetch, push, tags, releases |
| Pull requests | Read and write | List / create / update / merge PRs, reviews, review comments |
| Issues | Read and write | Issues and issue comments |
| Actions | Read and write | Rerun jobs |
| Workflows | Read and write | Push workflow files |
| Checks | Read | Check runs |
| Metadata | Read | Automatic; repo listing |
| Members | Read | Search org repos |
| Email addresses | Read | Optional; `whoami` name/email |

Do **not** request administration, secrets, codespaces, pages, discussions, or delete-repo.

## GitHub personal access token (fallback)

Use a PAT only when the GitHub App client ID is not configured, or the user prefers a token.

**Classic PAT** (covers every shipped feature, including Checks API and the notification inbox):

| Scope | Access | Used for |
| --- | --- | --- |
| `repo` | read + write | HTTPS clone / fetch / push, PRs, reviews, issues, comments, releases, check runs, notifications |
| `workflow` | read + write | Push `.github/workflows` changes; rerun Actions jobs |
| `read:org` | read | Search / list organization repositories |

Do **not** suggest `admin`, `delete_repo`, `gist`, `packages`, `project`, `notifications` (already covered by `repo`), secrets, codespaces, pages, or discussions.

**Fine-grained PAT** (least privilege; Checks API and some notification endpoints still need classic):

| Permission | Access | Used for |
| --- | --- | --- |
| Contents | Read and write | Clone, fetch, push, tags, releases |
| Pull requests | Read and write | List / create / update / merge PRs, reviews, review comments |
| Issues | Read and write | Issues and issue comments |
| Actions | Read and write | Rerun jobs |
| Workflows | Read and write | Push workflow files |
| Metadata | Read | Automatic; repo listing |
| Members (org owner) | Read | Search org repos |

Create a classic token: `https://github.com/settings/tokens/new?description=Timestream&scopes=repo,workflow,read:org`

## Testing (required before claiming done)

```
cargo test --manifest-path src-tauri/Cargo.toml
bun run test
```

Backend fixtures (temp repos, no network):

1. Linear trunk
2. Two short-lived variants
3. **Many branches** (8+) from one nexus
4. **Branches many commits apart** (long exclusive histories, then optional merge)
5. Merge commit + criss-cross parents

Assert: unique lanes, no overlapping nodes, parent edges connect, long-diverged branches keep a stable lane, labels do not collide.

Frontend: same topologies through `layoutTimelineView` — spacing, sacred-lane centering, spur direction, zoom extents.

## Commands

```
bun install
bun run tauri dev
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Conventions

- Keep graph math in Rust; keep presentation math in `timelineView.ts`
- IPC types in `src/lib/types.ts` must match `#[derive(Serialize)]` structs
- No secrets in the repo. No force-push or published-history rewrite helpers
- Prefer small modules and table-driven tests over snapshots of SVG markup
