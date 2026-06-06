import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, Caption, PlannedScene, ScriptData } from "../../types.ts";
import { ensureDir } from "../../utils/file.ts";
import { runFfmpeg } from "../../utils/ffmpeg.ts";
import { slugify } from "../../utils/slug.ts";
import { sceneFileName } from "../../utils/text.ts";

const REMOTION_ENTRY = "src/renderers/remotion/compositions/index.ts";
const REMOTION_COMPOSITION_ID = "ToolReelScene";
const REMOTION_BUNDLE_DIR = resolve(".remotion/bundle");
const REMOTION_PUBLIC_ASSET_DIR = "remotion-assets";
const LOCAL_CHROME_WRAPPER = resolve("scripts/remotion-chrome-wrapper.sh");

let bundledServeUrl: Promise<string> | undefined;

function getBundledServeUrl(): Promise<string> {
  bundledServeUrl ??= bundle({
    entryPoint: REMOTION_ENTRY,
    outDir: REMOTION_BUNDLE_DIR,
    enableCaching: false,
    ignoreRegisterRootWarning: false,
    onProgress: () => undefined,
  });
  return bundledServeUrl;
}

export async function renderRemotionScene(
  scene: PlannedScene,
  script: ScriptData,
  assets: AssetData,
  captions: Caption[],
  scenesDir: string,
): Promise<string> {
  const outputPath = join(scenesDir, sceneFileName(scene.index, scene.id));

  const browserAssets = await materializeAssetsForBrowser(assets, scenesDir);
  const inputProps = {
    scene,
    script,
    assets: browserAssets,
    captions: captionsForScene(scene, captions),
  };
  await renderWithRetry({ scene, outputPath, inputProps });

  return outputPath;
}

async function renderWithRetry({
  scene,
  outputPath,
  inputProps,
}: {
  scene: PlannedScene;
  outputPath: string;
  inputProps: {
    scene: PlannedScene;
    script: ScriptData;
    assets: AssetData;
    captions: Caption[];
  };
}): Promise<void> {
  const maxAttempts = Number(process.env.REMOTION_RENDER_ATTEMPTS || 2);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const serveUrl = await getBundledServeUrl();
      const remotionRuntime = getRemotionRuntimeOptions();
      const composition = await selectComposition({
        serveUrl,
        id: REMOTION_COMPOSITION_ID,
        inputProps,
        ...remotionRuntime,
      });

      await renderMedia({
        serveUrl,
        composition: {
          ...composition,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          fps: FPS,
          durationInFrames: Math.ceil(scene.duration * FPS),
        },
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        overwrite: true,
        pixelFormat: "yuv420p",
        crf: 20,
        concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
        timeoutInMilliseconds: Number(process.env.REMOTION_RENDER_TIMEOUT_MS || 120000),
        ...remotionRuntime,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
      console.warn(`Remotion render attempt ${attempt} failed for ${scene.id}; retrying with a fresh bundle.`);
      await resetRemotionBundle();
    }
  }

  throw lastError;
}

function captionsForScene(scene: PlannedScene, captions: Caption[]): Caption[] {
  const sceneStart = captions.find((caption) => caption.sceneId === scene.id)?.start ?? 0;
  return captions
    .filter((caption) => caption.sceneId === scene.id)
    .map((caption) => ({
      ...caption,
      start: Math.max(0, caption.start - sceneStart),
      end: Math.max(0, caption.end - sceneStart),
    }));
}

async function resetRemotionBundle(): Promise<void> {
  bundledServeUrl = undefined;
  await rm(REMOTION_BUNDLE_DIR, { recursive: true, force: true });
}

async function materializeAssetsForBrowser(assets: AssetData, scenesDir: string): Promise<AssetData> {
  const runId = slugify(resolve(scenesDir, ".."));
  const publicRelativeDir = `${REMOTION_PUBLIC_ASSET_DIR}/${runId}`;
  const remotionAssetsDir = resolve("public", publicRelativeDir);
  await ensureDir(remotionAssetsDir);

  return {
    ...assets,
    logo: await toBrowserImageSource(
      assets.logo,
      join(remotionAssetsDir, "logo.png"),
      `${publicRelativeDir}/logo.png`,
      96,
      96,
    ),
    websiteScreenshot: await toBrowserImageSource(
      assets.websiteScreenshot,
      join(remotionAssetsDir, "homepage-preview.jpg"),
      `${publicRelativeDir}/homepage-preview.jpg`,
      1280,
      860,
    ),
    productScreenshot: await toBrowserImageSource(
      assets.productScreenshot,
      join(remotionAssetsDir, "product-preview.jpg"),
      `${publicRelativeDir}/product-preview.jpg`,
      1280,
      860,
    ),
  };
}

async function toBrowserImageSource(
  source: string,
  previewPath: string,
  publicPath: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  if (!source || source === "unknown" || source.startsWith("mock://") || source.startsWith("data:")) {
    return source;
  }

  try {
    await createPreviewImage(source, previewPath, maxWidth, maxHeight);
    await readFile(previewPath);
    return `static:${publicPath}`;
  } catch {
    return "unknown";
  }
}

async function createPreviewImage(
  source: string,
  outputPath: string,
  maxWidth: number,
  maxHeight: number,
): Promise<void> {
  await ensureDir(dirname(outputPath));
  await runFfmpeg([
    "-y",
    "-i",
    source,
    "-vf",
    `scale=w=${maxWidth}:h=${maxHeight}:force_original_aspect_ratio=decrease`,
    "-frames:v",
    "1",
    outputPath,
  ]);
}

function getRemotionRuntimeOptions(): {
  browserExecutable?: string;
  port?: number;
  chromeMode: "chrome-for-testing" | "headless-shell";
  chromiumOptions: {
    gl: "angle";
    ignoreCertificateErrors: boolean;
  };
} {
  const rawPort = process.env.REMOTION_RENDER_PORT?.trim();
  const port = rawPort ? Number(rawPort) : undefined;
  const browserExecutable =
    process.env.REMOTION_CHROME_EXECUTABLE?.trim() || getDefaultBrowserExecutable();

  return {
    ...(browserExecutable ? { browserExecutable } : {}),
    ...(Number.isFinite(port) ? { port } : {}),
    chromeMode:
      process.env.REMOTION_CHROME_MODE === "chrome-for-testing" || browserExecutable
        ? "chrome-for-testing"
        : "headless-shell",
    chromiumOptions: {
      gl: "angle",
      ignoreCertificateErrors: true,
    },
  };
}

function getDefaultBrowserExecutable(): string | undefined {
  return existsSync(LOCAL_CHROME_WRAPPER) ? LOCAL_CHROME_WRAPPER : undefined;
}
