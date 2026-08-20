# Timestream marketing site

Astro + Tailwind + React. Deployed on Netlify (`netlify.toml`). Not part of the Tauri app.

```
bun install
bun run dev      # http://localhost:4321
bun run build
```

## WorkPath tour & syntax tokens

The homepage WorkPath embeds real desktop review/diff UI against fixtures in `src/lib/tourData.ts`.

To keep Lighthouse’s critical path short, the site does **not** ship Shiki (wasm + language grammars). Diff colors come from a generated token map:

| File | Role |
|------|------|
| `src/lib/tourData.ts` | Tour commits, status, and hunk fixtures |
| `src/lib/tourTokens.generated.ts` | Pre-tokenized lines (do not edit by hand) |
| `scripts/bake-tour-tokens.ts` | Runs Shiki once, writes the generated file |
| `src/mocks/syntaxHighlight.ts` | Vite alias target for `@/diff/syntaxHighlight` |

**When you change tour hunk text** (any `DIFF_BY_PATH` / `fileDiffFor` lines):

```
bun run bake:tokens
```

Then commit `src/lib/tourTokens.generated.ts` with the fixture change. Shiki is a **devDependency** for this script only.

Related Vite aliases in `astro.config.mjs`: slim `FileKindIcon`, mocked Tauri APIs, baked `syntaxHighlight`.
