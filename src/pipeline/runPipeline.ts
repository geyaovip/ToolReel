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
import { validateHyperFrameSceneVideo } from "../quality/validateSceneVideo.ts";
import { validateProductionQuality } from "../quality/validateProductionQuality.ts";
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
import type { Caption, GenerateInput, PipelineResult, PlannedScene, ScriptData, ToolInput, VideoType, VoiceData } from "../types.ts";
import { ensureDir, writeJson } from "../utils/file.ts";
import { slugify } from "../utils/slug.ts";
import { todayId } from "../utils/time.ts";

type RunPipelineArgs = {
  name: string;
  url: string;
  topic?: string;
  compareTargets?: ToolInput[];
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
    compareTargets: args.compareTargets,
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

  await writeJson(join(outputDir, "research.json"), research);
  await writeJson(join(outputDir, "creative.json"), creative);
  await writeJson(join(outputDir, "script.json"), script);
  const contentQuality = validateContentQuality(research, creative, script);
  await writeJson(join(outputDir, "content-quality.json"), contentQuality);
  await writeJson(join(outputDir, "assets.json"), assets);

  let renderPass = await renderActiveScenes({ scenes, script, assets, outputDir, scenesDir });
  let attempts = 1;
  while (renderPass.qaSkippedCount > 0 && attempts < 3) {
    attempts += 1;
    renderPass = await renderActiveScenes({
      scenes: renderPass.scenes,
      script,
      assets,
      outputDir,
      scenesDir,
    });
  }

  scenes = renderPass.scenes;
  const captions = renderPass.captions;
  const voice = renderPass.voice;
  const renderedScenes = renderPass.renderedScenes;

  await writeJson(join(outputDir, "captions.json"), captions);
  await writeFile(join(outputDir, "captions.srt"), captionsToSrt(captions), "utf8");
  await writeJson(join(outputDir, "scenes.json"), scenes);

  const cover = await generateCover(script, assets, join(outputDir, "cover.png"));
  await writeJson(join(outputDir, "cover.json"), cover);
  const finalVideo = await mergeScenes(renderedScenes, voice.outputPath, join(outputDir, "final.mp4"));
  const validation = await validateOutput(finalVideo);
  validation.checks.push(...validateAssetsForMvp(assets));
  validation.checks.push(...contentQuality.checks.map((item) => ({ ...item, name: `content:${item.name}` })));
  validation.checks.push(
    ...(await validateProductionQuality({
      finalVideo,
      validation,
      captions,
      cover,
      voice,
      script,
    })),
  );
  validation.checks.push(
    ...renderedScenes.flatMap((scene) =>
      (scene.renderQuality?.checks ?? []).map((check) => ({
        ...check,
        name: `scene:${scene.id}:${check.name}`,
      })),
    ),
  );
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

type RenderActiveScenesArgs = {
  scenes: PlannedScene[];
  script: ScriptData;
  assets: Awaited<ReturnType<typeof collectAssets>>;
  outputDir: string;
  scenesDir: string;
};

type RenderActiveScenesResult = {
  scenes: PlannedScene[];
  renderedScenes: PlannedScene[];
  captions: Caption[];
  voice: VoiceData;
  qaSkippedCount: number;
};

async function renderActiveScenes(args: RenderActiveScenesArgs): Promise<RenderActiveScenesResult> {
  const activeScenes = args.scenes.filter((scene) => scene.renderStatus !== "skipped");
  const activeScript = {
    ...args.script,
    segments: args.script.segments.filter((segment) =>
      activeScenes.some((scene) => scene.type === segment.sceneType && scene.title === segment.title),
    ),
  };
  const voice = await generateVoice(activeScript, join(args.outputDir, "voice.mp3"));
  const fittedScenes = ensureMinimumDuration(fitSceneDurationsToVoice(activeScenes, voice), 40);
  const captions = await generateCaptions(fittedScenes);

  const nextScenes = args.scenes.map((scene) => fittedScenes.find((item) => item.id === scene.id) ?? scene);
  const renderedOrSkipped: PlannedScene[] = [];
  let qaSkippedCount = 0;

  for (const scene of fittedScenes) {
    const outputPath =
      scene.renderer === "HyperFrames"
        ? await renderHyperFrameScene(scene, args.script, args.assets, captions, args.scenesDir)
        : await renderRemotionScene(scene, args.script, args.assets, captions, args.scenesDir);
    let renderedScene: PlannedScene = { ...scene, outputPath, renderStatus: "rendered" };

    if (scene.renderer === "HyperFrames") {
      const renderQuality = await validateHyperFrameSceneVideo(outputPath);
      renderedScene = { ...renderedScene, renderQuality };
      if (!renderQuality.passed) {
        qaSkippedCount += 1;
        renderedScene = {
          ...renderedScene,
          outputPath: undefined,
          renderStatus: "skipped",
          renderSkipReason: `HyperFrames scene skipped after QA failed: ${renderQuality.checks
            .filter((check) => !check.passed)
            .map((check) => check.name)
            .join(", ")}`,
        };
      }
    }

    renderedOrSkipped.push(renderedScene);
  }

  const scenes = nextScenes.map((scene) => renderedOrSkipped.find((item) => item.id === scene.id) ?? scene);
  return {
    scenes,
    renderedScenes: scenes.filter((scene) => scene.renderStatus === "rendered" && scene.outputPath),
    captions,
    voice,
    qaSkippedCount,
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
