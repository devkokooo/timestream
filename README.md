# 🕰️ Timestream

Local-first Git client. The commit graph is a TVA Chronomonitor: a gold Sacred Timeline with variant branches as spurs.

## Stack

Tauri 2 + React + TypeScript. Git via libgit2 (`git2`), never a `git` subprocess.

## Run

```
bun install
bun run tauri dev
```

Requires Bun, Rust, and Windows C++ build tools (or the platform equivalent).

## Test

```
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

Fixtures cover linear history, many simultaneous branches, and branches that diverge for dozens of commits.

## Design

Orange tile, board-formed concrete, sacred gold veining, manila dossiers, analog grain. See `AGENTS.md`.
