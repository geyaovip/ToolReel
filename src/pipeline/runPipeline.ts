import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collectAssets } from "../assets/collectAssets.ts";
import { generateCover } from "../cover/generateCover.ts";
import { generateCreativeBrief } from "../creative/generateCreativeBrief.ts";
import { mergeScenes } from "../merge/mergeScenes.ts";
import { validateOutput } from "../quality/validateOutput.ts";
import { validateAssetsForMvp } from "../quality/validateAssets.ts";
import { checkMvpReadiness } from "../quality/checkMvpReadiness.ts";
import { validateContentQuality } from "../quality/validateContentQuality.ts";
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
  topic?: string;
  type: VideoType;
};

export async function runPipeline(args: RunPipelineArgs): Promise<PipelineResult> {
  const outputSlug = args.type === "product_pick" ? slugify(args.name) : `${slugify(args.name)}-${slugify(args.type)}`;
  const outputDir = join("outputs", `${todayId()}-${outputSlug}`);
  const scenesDir = join(outputDir, "scenes");
  await ensureDir(scenesDir);

  const input: GenerateInput = {
    name: args.name,
    url: args.url,
    type: args.type,
    topic: "topic" in args ? args.topic : undefined,
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
    renderStatus: "planned" as const,
  })) satisfies PlannedScene[];
  scenes = scenes.map((scene) => skipUnavailableHyperFrameScene(scene, assets));
  const activeScenes = scenes.filter((scene) => scene.renderStatus !== "skipped");
  const activeScript = {
    ...script,
    segments: script.segments.filter((segment) =>
      activeScenes.some((scene) => scene.type === segment.sceneType && scene.title === segment.title),
    ),
  };
  const voice = await generateVoice(activeScript, join(outputDir, "voice.mp3"));
  const fittedScenes = ensureMinimumDuration(fitSceneDurationsToVoice(activeScenes, voice), 40);
  scenes = scenes.map((scene) => fittedScenes.find((item) => item.id === scene.id) ?? scene);
  const captions = await generateCaptions(fittedScenes);

  await writeJson(join(outputDir, "research.json"), research);
  await writeJson(join(outputDir, "creative.json"), creative);
  await writeJson(join(outputDir, "script.json"), script);
  const contentQuality = validateContentQuality(research, creative, script);
  await writeJson(join(outputDir, "content-quality.json"), contentQuality);
  await writeJson(join(outputDir, "assets.json"), assets);
  await writeJson(join(outputDir, "captions.json"), captions);
  await writeFile(join(outputDir, "captions.srt"), captionsToSrt(captions), "utf8");
  await writeJson(join(outputDir, "scenes.json"), scenes);

  const renderedScenes: PlannedScene[] = [];
  for (const scene of fittedScenes) {
    const outputPath =
      scene.renderer === "HyperFrames"
        ? await renderHyperFrameScene(scene, script, assets, captions, scenesDir)
        : await renderRemotionScene(scene, script, assets, captions, scenesDir);
    renderedScenes.push({ ...scene, outputPath, renderStatus: "rendered" });
  }
  scenes = scenes.map((scene) => renderedScenes.find((item) => item.id === scene.id) ?? scene);
  await writeJson(join(outputDir, "scenes.json"), scenes);

  const cover = await generateCover(script, assets, join(outputDir, "cover.png"));
  await writeJson(join(outputDir, "cover.json"), cover);
  const finalVideo = await mergeScenes(renderedScenes, voice.outputPath, join(outputDir, "final.mp4"));
  const validation = await validateOutput(finalVideo);
  validation.checks.push(...validateAssetsForMvp(assets));
  validation.checks.push(...contentQuality.checks.map((item) => ({ ...item, name: `content:${item.name}` })));
  validation.checks.push(...validateVisibleText(script, renderedScenes, captions));
  validation.passed = validation.checks.every((item) => item.passed);
  await writeJson(join(outputDir, "validation.json"), validation);

  const rendererSet = new Set(renderedScenes.map((scene) => scene.renderer));
  const renderMode = rendererSet.size > 1 ? "Hybrid" : renderedScenes[0]?.renderer ?? "Remotion";
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
  const mvpReadiness = await checkMvpReadiness(outputDir);

  return {
    outputDir,
    finalVideo,
    scenes,
    renderMode,
    validation,
    runManifest,
    mvpReadiness,
  };
}

function skipUnavailableHyperFrameScene(scene: PlannedScene, assets: Awaited<ReturnType<typeof collectAssets>>): PlannedScene {
  if (scene.renderer !== "HyperFrames") {
    return scene;
  }
  if (hasUsableWebAsset(scene, assets)) {
    return scene;
  }
  return {
    ...scene,
    renderStatus: "skipped",
    renderSkipReason: "HyperFrames scene skipped because no usable website or product screenshot was available.",
  };
}

function hasUsableWebAsset(scene: PlannedScene, assets: Awaited<ReturnType<typeof collectAssets>>): boolean {
  const selectedPath = scene.assetSelection ? assets.selectedAssets?.websiteDemoPage?.path ?? assets.selectedAssets?.featurePage?.path : undefined;
  return [selectedPath, assets.productPageScreenshot, assets.productScreenshot, assets.websiteScrollScreenshot, assets.websiteScreenshot].some(
    (path) => Boolean(path && path !== "unknown" && !path.startsWith("mock://") && !path.startsWith("http")),
  );
}

function ensureMinimumDuration(scenes: PlannedScene[], minimumSeconds: number): PlannedScene[] {
  const total = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (total >= minimumSeconds || !scenes.length) {
    return scenes;
  }
  const extra = Math.round((minimumSeconds - total) * 100) / 100;
  return scenes.map((scene, index) =>
    index === scenes.length - 1 ? { ...scene, duration: Math.round((scene.duration + extra) * 100) / 100 } : scene,
  );
}
