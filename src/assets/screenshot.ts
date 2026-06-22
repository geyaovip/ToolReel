import { access, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { launch } from "puppeteer-core";
import { ensureDir } from "../utils/file.ts";
import { cleanupStaleBrowserProfiles, commonHeadlessChromeFlags, MACOS_CHROME_EXECUTABLE } from "../utils/browser.ts";

const DEFAULT_CHROME_EXECUTABLE = resolve("scripts/remotion-chrome-wrapper.sh");
const SCREENSHOT_TIMEOUT_MS = Number(process.env.TOOLREEL_SCREENSHOT_TIMEOUT_MS || 90000);
const MIN_SCREENSHOT_BYTES = 10_000;

type ScreenshotAttempt = {
  width: number;
  height: number;
  settleMs: number;
  timeoutMs: number;
};

const SCREENSHOT_ATTEMPTS: ScreenshotAttempt[] = [
  { width: 1440, height: 2200, settleMs: 1800, timeoutMs: Math.min(SCREENSHOT_TIMEOUT_MS, 60000) },
  { width: 1080, height: 1920, settleMs: 3000, timeoutMs: SCREENSHOT_TIMEOUT_MS },
];

export async function captureWebsiteScreenshot(url: string, outputPath: string): Promise<string> {
  await ensureDir(dirname(outputPath));
  await cleanupStaleBrowserProfiles();
  const chrome = await firstUsableChrome();
  let lastError: unknown;

  for (const attempt of SCREENSHOT_ATTEMPTS) {
    try {
      await captureWithBrowser(url, outputPath, chrome, attempt);
      await assertScreenshotUsable(outputPath);
      return outputPath;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Website screenshot failed after ${SCREENSHOT_ATTEMPTS.length} real-browser attempts: ${messageOf(lastError)}`,
  );
}

async function captureWithBrowser(
  url: string,
  outputPath: string,
  chrome: string,
  attempt: ScreenshotAttempt,
): Promise<void> {
  const browser = await launch({
    executablePath: chrome,
    headless: true,
    protocolTimeout: Math.max(attempt.timeoutMs, 120000),
    args: [...commonHeadlessChromeFlags(), "--hide-scrollbars", `--window-size=${attempt.width},${attempt.height}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: attempt.width, height: attempt.height, deviceScaleFactor: 1 });
    page.setDefaultNavigationTimeout(attempt.timeoutMs);
    page.setDefaultTimeout(attempt.timeoutMs);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: attempt.timeoutMs });
    if (response && response.status() >= 400) {
      throw new Error(`Website returned HTTP ${response.status()} for ${url}.`);
    }
    await wait(attempt.settleMs);
    await page.screenshot({ path: resolve(outputPath), type: "png", captureBeyondViewport: false });
  } finally {
    await browser.close();
  }
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
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser runtime.
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

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
