import { join } from "node:path";
import type { AssetData, Caption, PlannedScene, ScriptData } from "../../types.ts";
import { sceneFileName } from "../../utils/text.ts";
import { renderSceneVideo } from "../shared/renderSceneVideo.ts";

export async function renderHyperFrameScene(
  scene: PlannedScene,
  script: ScriptData,
  assets: AssetData,
  captions: Caption[],
  scenesDir: string,
): Promise<string> {
  const outputPath = join(scenesDir, sceneFileName(scene.index, scene.id));
  await renderSceneVideo({
    scene,
    script,
    assets,
    captions: captionsForScene(scene, captions),
    outputPath,
    theme: "hyperframes",
  });
  return outputPath;
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
