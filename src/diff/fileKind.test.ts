import { describe, expect, it } from "vitest";
import { fileKindFromPath, isTestFile } from "@/diff/fileKind";

describe("fileKindFromPath", () => {
  it.each([
    ["src/components/ReviewMode.tsx", "react"],
    ["hooks/useFoo.jsx", "react"],
    ["pkg/mod.rs", "rust"],
    ["README.md", "markdown"],
    ["theme.css", "css"],
    ["lib/api.ts", "typescript"],
    ["types.d.ts", "typescript"],
    ["index.js", "javascript"],
    ["page.html", "html"],
    ["theme.scss", "sass"],
    ["data.json", "json"],
    ["config.yaml", "yaml"],
    ["main.py", "python"],
    ["cmd/root.go", "go"],
    ["logo.svg", "svg"],
    ["schema.xml", "xml"],
    ["photo.png", "image"],
    ["notes.mdx", "mdx"],
    ["setup.sh", "shell"],
    ["profile.ps1", "powershell"],
    ["Widget.vue", "vue"],
    ["Card.svelte", "svelte"],
    ["engine.cpp", "cpp"],
    ["util.h", "c"],
    ["Program.cs", "csharp"],
    ["src\\windows\\path.rs", "rust"],
  ])("maps %s to %s", (path, kind) => {
    expect(fileKindFromPath(path)).toBe(kind);
  });

  it.each([
    ["package.json", "npm"],
    ["src/package.json", "npm"],
    ["Dockerfile", "docker"],
    ["src/Dockerfile", "docker"],
    ["Makefile", "make"],
    ["Cargo.toml", "rust"],
    ["go.mod", "go"],
    [".gitignore", "git"],
    [".env", "dotenv"],
    [".env.local", "dotenv"],
    ["tsconfig.json", "typescript"],
    ["vite.config.ts", "vite"],
    [".editorconfig", "editorconfig"],
  ])("recognizes filename %s as %s", (path, kind) => {
    expect(fileKindFromPath(path)).toBe(kind);
  });

  it("falls back for unknown names", () => {
    expect(fileKindFromPath("LICENSE")).toBe("file");
    expect(fileKindFromPath("")).toBe("file");
  });
});

describe("isTestFile", () => {
  it.each([
    "src/lib/fileKind.test.ts",
    "src/components/ReviewMode.test.tsx",
    "hooks/useFoo.spec.ts",
    "pkg/mod_test.go",
    "test_parse.py",
    "parse_test.py",
    "src/__tests__/diffView.ts",
    "tests/graph.rs",
    "src\\lib\\fileKind.test.ts",
  ])("flags %s", (path) => {
    expect(isTestFile(path)).toBe(true);
  });

  it.each(["src/lib/fileKind.ts", "lib/api.ts", "contest/entry.ts", "latest.md", "src/testing.ts"])(
    "leaves %s as source",
    (path) => {
      expect(isTestFile(path)).toBe(false);
    },
  );
});
