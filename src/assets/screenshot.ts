import { access, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ensureDir } from "../utils/file.ts";

const DEFAULT_CHROME_EXECUTABLE = resolve("scripts/remotion-chrome-wrapper.sh");
const SCREENSHOT_TIMEOUT_MS = Number(process.env.TOOLREEL_SCREENSHOT_TIMEOUT_MS || 45000);

export async function captureWebsiteScreenshot(url: string, outputPath: string): Promise<string> {
  await ensureDir(dirname(outputPath));
  const chrome = process.env.REMOTION_CHROME_EXECUTABLE?.trim() || DEFAULT_CHROME_EXECUTABLE;
  await assertExecutableExists(chrome);
  const profileDir = await mkdtemp(join(tmpdir(), "toolreel-screenshot-profile-"));

  try {
    await runChrome([
      "--headless=new",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,2200",
      `--screenshot=${outputPath}`,
      url,
    ], chrome);
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }

  return outputPath;
}

async function assertExecutableExists(path: string): Promise<void> {
  await access(path);
}

function runChrome(args: string[], chrome: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Chrome screenshot timed out after ${SCREENSHOT_TIMEOUT_MS}ms.`));
    }, SCREENSHOT_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Chrome screenshot failed with code ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
