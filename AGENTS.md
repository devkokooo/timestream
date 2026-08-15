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
| `src-tauri/src/git.rs` | Open repo, walk history, status, diff, checkout, stage, commit |
| `src-tauri/src/commands.rs` | Tauri IPC surface — thin wrappers only |
| `src/lib/timelineView.ts` | Graph → SVG coordinates, lane spacing, label collision |
| `src/components/SacredTimeline.tsx` | Chronomonitor visualization |
| `src/styles/tva.css` | TVA tokens (orange, concrete, gold, analog grain) |

## Design language (Loki / TVA)

Do not look like GitHub, GitKraken, or a generic dark IDE.

- **Palette:** TVA orange (`#E85D04`), sacred gold (`#E8B86D` / `#F4C430`), board-formed concrete (`#2B2723`), cream paper (`#F5E6C8`), wood brown (`#5C4033`)
- **Timeline:** central gold-veined river; branches are variant spurs above/below; commits are nexus orbs
- **Chrome:** mid-century bureaucratic — dossier panels, stamps (`VARIANT`, `NEXUS`), CRT scanlines, analog grain. No cyan sci-fi glow
- **Type:** serif display for titles, IBM Plex Mono for SHAs and metadata

## Git rules

- Local-first: operate only on a user-selected working tree. No remotes, clone, or push in v1
- Graph input is refs + reachable commits. Default branch is the Sacred Timeline; others are variants
- Layout must stay consistent for: linear history, many simultaneous branches, and branches that diverge for dozens of commits
- Never rewrite history. Checkout / stage / commit only

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
- No secrets in the repo. No force-push or history rewrite helpers
- Prefer small modules and table-driven tests over snapshots of SVG markup
