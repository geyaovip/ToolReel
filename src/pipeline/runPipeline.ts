import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collectAssets } from "../assets/collectAssets.ts";
import { generateCover } from "../cover/generateCover.ts";
import { generateCreativeBrief } from "../creative/generateCreativeBrief.ts";
import { mergeScenes } from "../merge/mergeScenes.ts";
import { validateOutput } from "../quality/validateOutput.ts";
import { validateAssetsForMvp } from "../quality/validateAssets.ts";
import { validateVisibleText } from "../quality/validateVisibleText.ts";
import { researchTool } from "../research/researchTool.ts";
import { renderHyperFrameScene } from "../renderers/hyperframes/renderHyperFrameScene.ts";
import { renderRemotionScene } from "../renderers/remotion/renderRemotionScene.ts";
import { selectRenderer } from "../router/selectRenderer.ts";
import { writeRunManifest } from "../run/writeRunManifest.ts";
import { planScenes } from "../scenes/planScenes.ts";
import { generateScript } from "../script/generateScript.ts";
import { captionsToSrt, fitSceneDurationsToVoice, generateCaptions } from "../subtitles/generateCaptions.ts";
import { generateVoice } from "../tts/generateVoice.ts";
import type { GenerateInput, PipelineResult, PlannedScene, VideoType } from "../types.ts";
import { ensureDir, writeJson } from "../utils/file.ts";
import { slugify } from "../utils/slug.ts";
import { todayId } from "../utils/time.ts";

type RunPipelineArgs = {
  name: string;
  url: string;
  type: VideoType;
};

export async function runPipeline(args: RunPipelineArgs): Promise<PipelineResult> {
  const outputDir = join("outputs", `${todayId()}-${slugify(args.name)}`);
  const scenesDir = join(outputDir, "scenes");
  await ensureDir(scenesDir);

  const input: GenerateInput = {
    name: args.name,
    url: args.url,
    type: args.type,
    createdAt: new Date().toISOString(),
    outputDir,
  };
  await writeJson(join(outputDir, "input.json"), input);

  const research = await researchTool(input);
  const creative = await generateCreativeBrief(input, research);
  const script = await generateScript(input, research, creative);
  const assets = await collectAssets(input);
  let scenes = planScenes(script, creative, assets).map((scene) => ({
    ...scene,
    renderer: selectRenderer(scene.type),
  })) satisfies PlannedScene[];
  const voice = await generateVoice(script, join(outputDir, "voice.mp3"));
  scenes = fitSceneDurationsToVoice(scenes, voice);
  const captions = await generateCaptions(scenes);

  await writeJson(join(outputDir, "research.json"), research);
  await writeJson(join(outputDir, "creative.json"), creative);
  await writeJson(join(outputDir, "script.json"), script);
  await writeJson(join(outputDir, "assets.json"), assets);
  await writeJson(join(outputDir, "captions.json"), captions);
  await writeFile(join(outputDir, "captions.srt"), captionsToSrt(captions), "utf8");
  await writeJson(join(outputDir, "scenes.json"), scenes);

  const renderedScenes: PlannedScene[] = [];
  for (const scene of scenes) {
    const outputPath =
      scene.renderer === "HyperFrames"
        ? await renderHyperFrameScene(scene, script, assets, captions, scenesDir)
        : await renderRemotionScene(scene, script, assets, captions, scenesDir);
    renderedScenes.push({ ...scene, outputPath });
  }
  scenes = renderedScenes;
  await writeJson(join(outputDir, "scenes.json"), scenes);

  await generateCover(script, assets, join(outputDir, "cover.png"));
  const finalVideo = await mergeScenes(scenes, voice.outputPath, join(outputDir, "final.mp4"));
  const validation = await validateOutput(finalVideo);
  validation.checks.push(...validateAssetsForMvp(assets));
  validation.checks.push(...validateVisibleText(script, scenes, captions));
  validation.passed = validation.checks.every((item) => item.passed);
  await writeJson(join(outputDir, "validation.json"), validation);

  const rendererSet = new Set(scenes.map((scene) => scene.renderer));
  const renderMode = rendererSet.size > 1 ? "Hybrid" : scenes[0]?.renderer ?? "Remotion";
  const runManifest = await writeRunManifest({
    outputDir,
    finalVideo,
    renderMode,
    input,
    research,
    creative,
    script,
    assets,
    captions,
    voice,
    scenes,
    validation,
  });

  return {
    outputDir,
    finalVideo,
    scenes,
    renderMode,
    validation,
    runManifest,
  };
}
