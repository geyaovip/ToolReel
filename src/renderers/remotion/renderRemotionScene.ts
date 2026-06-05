import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, PlannedScene, ScriptData } from "../../types.ts";
import { sceneFileName } from "../../utils/text.ts";

const REMOTION_ENTRY = "src/renderers/remotion/compositions/index.ts";
const REMOTION_COMPOSITION_ID = "ToolReelScene";
const CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REMOTION_RENDER_PORT = 39777;

let bundledServeUrl: Promise<string> | undefined;

function getBundledServeUrl(): Promise<string> {
  bundledServeUrl ??= bundle({
    entryPoint: REMOTION_ENTRY,
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

  const serveUrl = await getBundledServeUrl();
  const inputProps = {
    scene,
    script,
    assets,
  };
  const composition = await selectComposition({
    serveUrl,
    id: REMOTION_COMPOSITION_ID,
    inputProps,
    browserExecutable: CHROME_EXECUTABLE,
    port: REMOTION_RENDER_PORT,
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
    crf: 22,
    browserExecutable: CHROME_EXECUTABLE,
    port: REMOTION_RENDER_PORT,
  });

  return outputPath;
}
