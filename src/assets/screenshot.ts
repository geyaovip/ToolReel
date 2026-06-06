import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { ensureDir } from "../utils/file.ts";

const DEFAULT_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function captureWebsiteScreenshot(url: string, outputPath: string): Promise<string> {
  await ensureDir(dirname(outputPath));
  const chrome = process.env.REMOTION_CHROME_EXECUTABLE?.trim() || DEFAULT_CHROME_EXECUTABLE;
  await assertExecutableExists(chrome);

  await runChrome([
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--window-size=1440,2200",
    `--screenshot=${outputPath}`,
    url,
  ], chrome);

  return outputPath;
}

async function assertExecutableExists(path: string): Promise<void> {
  await access(path);
}

function runChrome(args: string[], chrome: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Chrome screenshot failed with code ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
