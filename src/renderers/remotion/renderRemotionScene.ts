import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, PlannedScene, ScriptData } from "../../types.ts";
import { ensureDir } from "../../utils/file.ts";
import { runFfmpeg } from "../../utils/ffmpeg.ts";
import { slugify } from "../../utils/slug.ts";
import { sceneFileName } from "../../utils/text.ts";

const REMOTION_ENTRY = "src/renderers/remotion/compositions/index.ts";
const REMOTION_COMPOSITION_ID = "ToolReelScene";
const DEFAULT_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REMOTION_BUNDLE_DIR = resolve(".remotion/bundle");
const REMOTION_PUBLIC_ASSET_DIR = "remotion-assets";

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
  scenesDir: string,
): Promise<string> {
  const outputPath = join(scenesDir, sceneFileName(scene.index, scene.id));

  const browserAssets = await materializeAssetsForBrowser(assets, scenesDir);
  const inputProps = {
    scene,
    script,
    assets: browserAssets,
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
          durationInFrames: scene.duration * FPS,
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
  browserExecutable: string;
  port?: number;
} {
  const rawPort = process.env.REMOTION_RENDER_PORT?.trim();
  const port = rawPort ? Number(rawPort) : undefined;

  return {
    browserExecutable: process.env.REMOTION_CHROME_EXECUTABLE?.trim() || DEFAULT_CHROME_EXECUTABLE,
    ...(Number.isFinite(port) ? { port } : {}),
  };
}
