import { join } from "node:path";
import type { AssetData, PlannedScene, ScriptData } from "../../types.ts";
import { sceneFileName } from "../../utils/text.ts";
import { renderSceneVideo } from "../shared/renderSceneVideo.ts";

export async function renderHyperFrameScene(
  scene: PlannedScene,
  script: ScriptData,
  assets: AssetData,
  scenesDir: string,
): Promise<string> {
  const outputPath = join(scenesDir, sceneFileName(scene.index, scene.id));
  await renderSceneVideo({
    scene,
    script,
    assets,
    outputPath,
    theme: "hyperframes",
  });
  return outputPath;
}

