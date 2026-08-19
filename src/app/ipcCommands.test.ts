import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IPC_COMMANDS, IPC_COMMAND_COUNT } from "./ipcCommands";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "gallery") continue;
      walk(full, out);
    } else if (full.endsWith("api.ts")) out.push(full);
  }
  return out;
}

describe("IPC command freeze", () => {
  it("locks the shipped command list", () => {
    expect(IPC_COMMANDS).toHaveLength(IPC_COMMAND_COUNT);
    expect(new Set(IPC_COMMANDS).size).toBe(IPC_COMMAND_COUNT);
  });

  it("every invoke() in slice api modules is on the frozen list", () => {
    const found = new Set<string>();
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/invoke\(\s*"([a-z0-9_]+)"/g)) {
        found.add(match[1]);
      }
    }
        expect([...found].sort()).toEqual([...IPC_COMMANDS].sort());
  });
});
