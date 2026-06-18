import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cleanupStaleBrowserProfiles, MACOS_CHROME_EXECUTABLE } from "../src/utils/browser.ts";

const remotionHeadlessShell = resolve("node_modules/.remotion/chrome-headless-shell");

async function countProfiles(root: string): Promise<number> {
  try {
    const entries = await readdir(root);
    return entries.filter(
      (entry) =>
        entry.startsWith("toolreel-remotion-chrome-profile.") ||
        entry.startsWith("toolreel-screenshot-profile-"),
    ).length;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const before = (await countProfiles("/private/tmp")) + (await countProfiles(tmpdir()));
  if (process.argv.includes("--cleanup")) {
    await cleanupStaleBrowserProfiles();
  }
  const after = (await countProfiles("/private/tmp")) + (await countProfiles(tmpdir()));

  console.log(JSON.stringify({
    systemChrome: existsSync(MACOS_CHROME_EXECUTABLE) ? MACOS_CHROME_EXECUTABLE : "missing",
    remotionHeadlessShell: existsSync(remotionHeadlessShell) ? remotionHeadlessShell : "missing",
    staleToolReelProfilesBefore: before,
    staleToolReelProfilesAfter: after,
    cleanupApplied: process.argv.includes("--cleanup"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
