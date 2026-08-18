import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const origin = process.env.OG_ORIGIN ?? "http://localhost:4321";
const out = fileURLToPath(new URL("../public/og.png", import.meta.url));

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((value): value is string => Boolean(value));

const chrome = chromeCandidates.find((path) => existsSync(path));
if (!chrome) {
  throw new Error("Chrome or Edge not found. Set CHROME_PATH.");
}

console.log(`capturing ${origin}/og → ${out}`);

const args = [
  "--headless=new",
  "--hide-scrollbars",
  "--no-first-run",
  "--force-device-scale-factor=2",
  "--window-size=1200,630",
  "--virtual-time-budget=8000",
  `--screenshot=${out}`,
  `${origin}/og`,
];

await new Promise<void>((resolve, reject) => {
  const child = spawn(chrome, args, { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${chrome} exited ${code}`));
  });
});

console.log(`wrote ${out}`);
