# Timestream — Agent Guide

A local-first TVA-styled Git client with GitHub integration.

The commit graph is rendered as a TVA Chronomonitor: a glowing Sacred Timeline with variant branches as spurs.

## Ethos (read first)

Timestream’s direction is godly craftsmanship: code as vocation, stewardship, and neighbor-love. Maintainers pledge the spirit of [CODE_OF_ETHICS.md](CODE_OF_ETHICS.md) - a one-way covenant to users and contributors. Belief is not required of agents or contributors; the fruit of that covenant in this repo is.

When you work here, prefer:

- **Diligence and care** over haste or clever tricks
- **Clarity over cleverness**; avoid needless complexity
- **Truth in speech and diffs** - no false peace, no deceptive UX, no silent footguns
- **Service over acclaim** - measure success by how well the tool serves the user
- **Leave the project better than you found it**
- **Credit others’ work**; do not exploit users or contributors
- **Mercy in reviews and docs** - reviews and documentation are service
- **Steward secrets and history** - keychain for credentials; never rewrite published history; no force-push helpers

Do not add features that harvest, deceive, or coerce. Prefer local-first honesty: the user owns their worktree; the app is a careful steward of it.

Full clauses, grace disclaimer, and theological roots: [CODE_OF_ETHICS.md](CODE_OF_ETHICS.md).

## Stack

- **Desktop:** Tauri 2 (Rust) + React 18 + TypeScript + Vite
- **Git:** `git2` (libgit2 + OpenSSL, vendored) — never shell out to `git` for product logic
- **Package manager:** Bun
- **Marketing site:** Astro + Tailwind + React in `site/`, Netlify adapter. Not part of `tauri dev` or `bun run test`.
- **Tests:** `cargo test` (graph + git fixtures), `bun run test` (Vitest: view-model + layout), `bun run gallery` (visual UI suite)

## Layout

Frontend and Rust trees use the same slice names. Open `src/` or `src-tauri/src/` to see the shipped features.

| Path | Role |
|------|------|
| `src/app/` | App composer (layout + mode switching) |
| `src/ui/` | TVA primitives, tokens, `styles/` |
| `src/git/` | Open-repo kernel types/IPC |
| `src/timeline/` | Chronomonitor, rails, commit dossier, graph walk |
| `src/worktree/` | Status, stage, commit, amend, ReviewMode |
| `src/diff/` | DiffViewer, hunk layout, syntax highlight |
| `src/branches/` | Local branch CRUD |
| `src/remotes/` | Clone, fetch, ff-pull, push, WelcomeGate |
| `src/ssh/` | Keys, agent, IdentityPicker |
| `src/auth/` | Forge-agnostic session wrapper (`ForgeUser`, AuthDialog shell) |
| `src/github/` | GitHub forge: `auth/`, `pulls/`, `issues/`, `releases/`, `checks/`, `reviews/` |
| `src/settings/` | `settings.toml` UI + command palette |
| `src/shell/` | Title bar, bureau header, status bar |
| `src/gallery/` | Specimen Desk visual UI suite |
| `src-tauri/src/timeline/` | Pure graph layout + history walk |
| `src-tauri/src/git/` | Open repo + shared git2 helpers |
| `src-tauri/src/worktree/` | Status, stage, commit, unpublished-HEAD amend |
| `src-tauri/src/diff/` | Commit / worktree / range diffs |
| `src-tauri/src/branches/` | Checkout, create, rename, delete |
| `src-tauri/src/remotes/` | libgit2 remotes, clone, fetch, ff-pull, push |
| `src-tauri/src/ssh/` | ssh-agent, keys, OpenSSH transport |
| `src-tauri/src/auth/` | Keychain + session; forge-agnostic `credential_for` |
| `src-tauri/src/github/` | GitHub HTTP client + nested PR/issue/release modules |
| `src-tauri/src/settings/` | Versioned `settings.toml` |
| `site/` | Marketing site (Astro). Separate Netlify deploy |

`#[tauri::command]` handlers live next to domain code. Command **names** are frozen in `src/app/ipcCommands.ts`.

Tests live in the slice they lock. Gate: `cargo test --manifest-path src-tauri/Cargo.toml`, `bun run test`, `bunx tsc --noEmit`, `bunx vite build --config vite.gallery.config.ts`.

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

| Permission      | Access         | Used for                                                     |
|-----------------|----------------|--------------------------------------------------------------|
| Contents        | Read and write | Clone, fetch, push, tags, releases                           |
| Pull requests   | Read and write | List / create / update / merge PRs, reviews, review comments |
| Issues          | Read and write | Issues and issue comments                                    |
| Actions         | Read and write | Rerun jobs                                                   |
| Workflows       | Read and write | Push workflow files                                          |
| Checks          | Read           | Check runs                                                   |
| Metadata        | Read           | Automatic; repo listing                                      |
| Members         | Read           | Search org repos                                             |
| Email addresses | Read           | Optional; `whoami` name/email                                |

Do **not** request administration, secrets, codespaces, pages, discussions, or delete-repo.

## GitHub personal access token (fallback)

Use a PAT only when the GitHub App client ID is not configured, or the user prefers a token.

**Classic PAT** (covers every shipped feature, including Checks API and the notification inbox):

| Scope      | Access       | Used for                                                                                        |
|------------|--------------|-------------------------------------------------------------------------------------------------|
| `repo`     | read + write | HTTPS clone / fetch / push, PRs, reviews, issues, comments, releases, check runs, notifications |
| `workflow` | read + write | Push `.github/workflows` changes; rerun Actions jobs                                            |
| `read:org` | read         | Search / list organization repositories                                                         |

Do **not** suggest `admin`, `delete_repo`, `gist`, `packages`, `project`, `notifications` (already covered by `repo`), secrets, codespaces, pages, or discussions.

**Fine-grained PAT** (least privilege; Checks API and some notification endpoints still need classic):

| Permission          | Access         | Used for                                                     |
|---------------------|----------------|--------------------------------------------------------------|
| Contents            | Read and write | Clone, fetch, push, tags, releases                           |
| Pull requests       | Read and write | List / create / update / merge PRs, reviews, review comments |
| Issues              | Read and write | Issues and issue comments                                    |
| Actions             | Read and write | Rerun jobs                                                   |
| Workflows           | Read and write | Push workflow files                                          |
| Metadata            | Read           | Automatic; repo listing                                      |
| Members (org owner) | Read           | Search org repos                                             |

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

Visual UI suite (browser only, no Tauri):

```
bun run gallery
```

Opens the Specimen Desk at http://localhost:1422. Stamps (`SUCCESS` / `LOADING` / `ERROR` / `EMPTY`) drive fixture props and stubbed `invoke()` so every interactive surface can be inspected. Hash `#/exhibit-id/error` is shareable. Gallery Vite aliases (`vite.gallery.config.ts`) must not leak into `tauri dev` / production `vite build`. Add an exhibit in `src/gallery/exhibits/` and register it in `src/gallery/registry.tsx` when you ship a new surface or a new loading/error/empty state.

## Commands

```
bun install
bun run tauri dev
bun run gallery
bun run test
bun run bundle:release
cargo test --manifest-path src-tauri/Cargo.toml
cd site && bun install && bun run dev
cd site && bun run bake:tokens   # after editing WorkPath / tour diff fixtures
```

## Marketing site (`site/`)

Separate Astro app (Netlify). Not part of `tauri dev` / `bun run test`.

- WorkPath desks hydrate with `client:visible` and mount per-step near the viewport.
- Diff syntax highlight on the tour is **baked**, not live Shiki: `site/src/lib/tourTokens.generated.ts`.
- After changing hunk text in `site/src/lib/tourData.ts`, run `cd site && bun run bake:tokens` and commit the regenerated file.
- Vite aliases stub `@/diff/syntaxHighlight` and slim `@/ui/FileKindIcon` so Shiki wasm/grammars never ship to the client. Shiki is a site **devDependency** for the bake script only.

See `site/README.md`.

## Conventions

- Keep graph math in Rust (`src-tauri/src/timeline/graph.rs`); keep presentation math in `src/timeline/timelineView.ts`
- IPC types live per slice and must match `#[derive(Serialize)]` structs
- New forge (GitLab, Gitea, Forgejo) = new top-level slice plus an `auth/` provider; do not grow `github/`
- New work (bisect, conflicts) = new top-level slice; conflicts import `diff/`
- No secrets in the repo. No force-push or published-history rewrite helpers
- Prefer small modules and table-driven tests over snapshots of SVG markup
- Tests live in the slice they lock
- Prefer clarity, diligence, and leaving the project better than you found it (see Ethos / CODE_OF_ETHICS.md)
