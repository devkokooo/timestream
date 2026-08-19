import { describe, expect, it } from "vitest";
import { bundledLanguages } from "shiki";
import { languageFromPath } from "@/diff/syntaxLang";

describe("languageFromPath", () => {
  it.each([
    ["src/app.tsx", "tsx"],
    ["lib/api.ts", "ts"],
    ["hooks/useFoo.ts", "ts"],
    ["types.d.ts", "typescript"],
    ["pkg/mod.rs", "rs"],
    ["main.py", "py"],
    ["cmd/root.go", "go"],
    ["Main.java", "java"],
    ["App.kt", "kt"],
    ["util.c", "c"],
    ["util.h", "c"],
    ["engine.cpp", "cpp"],
    ["engine.hpp", "cpp"],
    ["Program.cs", "cs"],
    ["gem.rb", "rb"],
    ["index.php", "php"],
    ["View.swift", "swift"],
    ["page.html", "html"],
    ["theme.css", "css"],
    ["theme.scss", "scss"],
    ["data.json", "json"],
    ["config.yaml", "yaml"],
    ["config.yml", "yml"],
    ["Cargo.toml", "toml"],
    ["README.md", "md"],
    ["notes.mdx", "mdx"],
    ["setup.sh", "sh"],
    ["profile.ps1", "ps1"],
    ["query.sql", "sql"],
    ["schema.xml", "xml"],
    ["logo.svg", "xml"],
    ["Widget.vue", "vue"],
    ["Card.svelte", "svelte"],
    ["script.lua", "lua"],
    ["Main.hs", "hs"],
    ["App.scala", "scala"],
    ["main.dart", "dart"],
    ["mix.exs", "elixir"],
    ["core.clj", "clj"],
    ["plot.r", "r"],
    ["script.pl", "perl"],
    ["schema.graphql", "graphql"],
    ["api.proto", "proto"],
    ["main.zig", "zig"],
    ["lib.nim", "nim"],
    ["Main.fs", "fs"],
    ["View.m", "objective-c"],
    ["View.mm", "objective-cpp"],
    ["Vault.sol", "solidity"],
    ["main.tf", "tf"],
    ["scene.glsl", "glsl"],
    ["pass.frag", "glsl"],
    ["init.vim", "vim"],
    ["flake.nix", "nix"],
    ["Schema.prisma", "prisma"],
    ["page.astro", "astro"],
    ["template.erb", "erb"],
    ["layout.haml", "haml"],
    ["index.pug", "pug"],
    ["fix.patch", "diff"],
    ["App.tsx", "tsx"],
    ["src\\windows\\path.rs", "rs"],
  ])("maps %s to %s", (path, lang) => {
    expect(languageFromPath(path)).toBe(lang);
  });

  it.each([
    ["Dockerfile", "docker"],
    ["src/Dockerfile", "docker"],
    ["Makefile", "make"],
    ["CMakeLists.txt", "cmake"],
    ["Gemfile", "ruby"],
    ["Justfile", "just"],
    ["Jenkinsfile", "groovy"],
    ["go.mod", "go"],
    ["tsconfig.json", "jsonc"],
    [".env", "dotenv"],
    [".env.local", "dotenv"],
    [".gitignore", "properties"],
    [".editorconfig", "ini"],
  ])("recognizes filename %s as %s", (path, lang) => {
    expect(languageFromPath(path)).toBe(lang);
  });

  it("returns null when there is no extension or known name", () => {
    expect(languageFromPath("LICENSE")).toBeNull();
    expect(languageFromPath("src/Makefile.bak/notes")).toBeNull();
  });

  it("emits ids Shiki actually ships", () => {
    const samples = [
      "a.tsx",
      "a.rs",
      "a.py",
      "a.go",
      "util.h",
      "engine.hpp",
      "Dockerfile",
      "Makefile",
      "Justfile",
      ".env",
      "types.d.ts",
      "pass.frag",
      "View.mm",
      "fix.patch",
      "Cargo.toml",
    ];
    for (const path of samples) {
      const lang = languageFromPath(path);
      expect(lang, path).toBeTruthy();
      expect(lang! in bundledLanguages, `${path} → ${lang}`).toBe(true);
    }
  });
});
