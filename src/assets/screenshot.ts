import { access, mkdtemp, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ensureDir } from "../utils/file.ts";

const DEFAULT_CHROME_EXECUTABLE = resolve("scripts/remotion-chrome-wrapper.sh");
const MACOS_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCREENSHOT_TIMEOUT_MS = Number(process.env.TOOLREEL_SCREENSHOT_TIMEOUT_MS || 20000);
const MIN_SCREENSHOT_BYTES = 10_000;

type ScreenshotAttempt = {
  width: number;
  height: number;
  virtualTimeBudgetMs: number;
};

const SCREENSHOT_ATTEMPTS: ScreenshotAttempt[] = [
  { width: 1440, height: 2200, virtualTimeBudgetMs: 8000 },
  { width: 1080, height: 1920, virtualTimeBudgetMs: 12000 },
];

export async function captureWebsiteScreenshot(url: string, outputPath: string): Promise<string> {
  await ensureDir(dirname(outputPath));
  const chrome = await firstUsableChrome();
  let lastError: unknown;

  for (const attempt of SCREENSHOT_ATTEMPTS) {
    try {
      await captureWithChrome(url, outputPath, chrome, attempt);
      await assertScreenshotUsable(outputPath);
      return outputPath;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function captureWithChrome(
  url: string,
  outputPath: string,
  chrome: string,
  attempt: ScreenshotAttempt,
): Promise<void> {
  const profileDir = await mkdtemp(join(tmpdir(), "toolreel-screenshot-profile-"));

  try {
    await runChrome(
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-crash-reporter",
        "--disable-crashpad",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--run-all-compositor-stages-before-draw",
        `--virtual-time-budget=${attempt.virtualTimeBudgetMs}`,
        `--user-data-dir=${profileDir}`,
        `--window-size=${attempt.width},${attempt.height}`,
        `--screenshot=${outputPath}`,
        url,
      ],
      chrome,
    );
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function assertExecutableExists(path: string): Promise<void> {
  await access(path);
}

async function firstUsableChrome(): Promise<string> {
  const candidates = [
    process.env.TOOLREEL_SCREENSHOT_CHROME_EXECUTABLE?.trim(),
    process.env.REMOTION_CHROME_EXECUTABLE?.trim(),
    MACOS_CHROME_EXECUTABLE,
    DEFAULT_CHROME_EXECUTABLE,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await assertExecutableExists(candidate);
      return candidate;
    } catch {
      // Try the next Chrome candidate.
    }
  }

  throw new Error(`No Chrome executable found for screenshots. Tried: ${candidates.join(", ")}`);
}

async function assertScreenshotUsable(path: string): Promise<void> {
  const info = await stat(path);
  if (info.size < MIN_SCREENSHOT_BYTES) {
    throw new Error(`Chrome screenshot output is too small: ${info.size} bytes.`);
  }
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
