/**
 * Bump or print the synced Timestream version.
 *
 * Usage:
 *   bun scripts/version.ts
 *   bun scripts/version.ts --set 0.3.0
 *   bun scripts/version.ts --patch | --minor | --major
 */
import {
  bumpMajor,
  bumpMinor,
  bumpPatch,
  parseSemVer,
  readSyncedVersion,
  writeSyncedVersion,
} from "./lib/version";

function printHelp(): void {
  console.log(`Sync Timestream version across product + site + gallery files.

Usage: bun scripts/version.ts [options]

Options:
  --set <X.Y.Z>   Set an exact version
  --major         Bump major (X+1.0.0)
  --minor         Bump minor (X.Y+1.0)
  --patch         Bump patch (X.Y.Z+1)
  -h, --help      Show this help

With no options, print the current synced version.
Does not commit, tag, or push.
`);
}

function parseArgs(argv: string[]): { set?: string; bump?: "major" | "minor" | "patch" } {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  let set: string | undefined;
  let bump: "major" | "minor" | "patch" | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--set") {
      const value = argv[++i];
      if (!value) throw new Error("--set requires X.Y.Z");
      set = value;
    } else if (arg === "--major" || arg === "--minor" || arg === "--patch") {
      if (bump) throw new Error("Use only one of --major, --minor, --patch");
      bump = arg.slice(2) as "major" | "minor" | "patch";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (set && bump) {
    throw new Error("Use either --set or a bump flag, not both");
  }

  return { set, bump };
}

const { set, bump } = parseArgs(process.argv.slice(2));
const current = readSyncedVersion();

if (!set && !bump) {
  console.log(current);
  process.exit(0);
}

let next: string;
if (set) {
  if (!parseSemVer(set)) throw new Error(`Not a plain semver X.Y.Z: ${set}`);
  next = set;
} else if (bump === "major") {
  next = bumpMajor(current);
} else if (bump === "minor") {
  next = bumpMinor(current);
} else {
  next = bumpPatch(current);
}

const result = writeSyncedVersion(next);
if (result.from === result.to) {
  console.log(`Already at ${result.to}`);
} else {
  console.log(`${result.from} → ${result.to}`);
}
for (const file of result.files) {
  console.log(`  ${file}`);
}
if (result.from !== result.to) {
  console.log("Commit, then: git tag v" + result.to + " && git push origin v" + result.to);
}
