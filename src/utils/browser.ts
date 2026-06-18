import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MACOS_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TOOLREEL_PROFILE_PREFIXES = [
  "toolreel-remotion-chrome-profile.",
  "toolreel-screenshot-profile-",
];

export function systemChromeExecutable(): string | undefined {
  return existsSync(MACOS_CHROME_EXECUTABLE) ? MACOS_CHROME_EXECUTABLE : undefined;
}

export async function cleanupStaleBrowserProfiles(): Promise<void> {
  const roots = ["/private/tmp", tmpdir()];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }

    await Promise.all(
      entries
        .filter((entry) => TOOLREEL_PROFILE_PREFIXES.some((prefix) => entry.startsWith(prefix)))
        .map((entry) => rm(join(root, entry), { recursive: true, force: true }).catch(() => undefined)),
    );
  }
}

export function commonHeadlessChromeFlags(): string[] {
  return [
    "--disable-background-networking",
    "--disable-breakpad",
    "--disable-component-update",
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter",
    "--disable-gpu",
    "--disable-hang-monitor",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--password-store=basic",
    "--use-mock-keychain",
  ];
}
