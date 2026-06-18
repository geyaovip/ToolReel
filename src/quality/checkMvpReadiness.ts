import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AssetData,
  Caption,
  ContentQualityReport,
  MvpReadiness,
  OutputValidation,
  OutputValidationCheck,
  PlannedScene,
  RunManifest,
  SceneType,
  VideoType,
} from "../types.ts";
import { writeJson } from "../utils/file.ts";

type ArtifactBundle = {
  run: RunManifest;
  validation: OutputValidation;
  contentQuality: ContentQualityReport;
  assets: AssetData;
  captions: Caption[];
  scenes: PlannedScene[];
};

const REQUIRED_FILES = [
  "input.json",
  "research.json",
  "creative.json",
  "script.json",
  "content-quality.json",
  "assets.json",
  "captions.json",
  "captions.srt",
  "voice.mp3",
  "voice.json",
  "cover.png",
  "cover.json",
  "scenes.json",
  "validation.json",
  "first-frame.png",
  "run.json",
  "final.mp4",
];

const REQUIRED_CHECKS = [
  "width",
  "height",
  "fps",
  "audioSampleRate",
  "startAtZero",
  "durationWithinMvpRange",
  "noOpeningBlackFrames",
  "websiteVisualAssetAvailable",
  "noForbiddenVisibleText",
  "noVisibleLinks",
  "sceneGuidancePresent",
  "sceneAssetSelectionPresent",
];

export async function checkMvpReadiness(outputDir: string): Promise<MvpReadiness> {
  const bundle = await readArtifacts(outputDir);
  const requiredScenes = requiredScenesFor(bundle.run.input.type);
  const requiresUrlAssets = bundle.run.input.type !== "top_list";
  const checks = [
    check("runPassed", bundle.run.status === "passed", bundle.run.status, "passed"),
    check("validationPassed", bundle.validation.passed, bundle.validation.passed, true),
    check("contentQualityPassed", bundle.contentQuality.passed, bundle.contentQuality.passed, true),
    check("requiredFilesPresent", await requiredFilesPresent(outputDir), REQUIRED_FILES.length, REQUIRED_FILES.length),
    check(
      "requiredScenesPresent",
      requiredScenes.every((sceneType) => hasScene(bundle.scenes, sceneType)),
      bundle.scenes.map((scene) => scene.type).join(", "),
      requiredScenes.join(", "),
    ),
    check("realTtsProvider", bundle.run.summary.voiceProvider !== "mock", bundle.run.summary.voiceProvider, "real TTS provider"),
    check("captionCount", bundle.captions.length >= 8, bundle.captions.length, ">=8"),
    check(
      "researchSources",
      !requiresUrlAssets || bundle.run.summary.researchSourcePageCount >= 1,
      bundle.run.summary.researchSourcePageCount,
      requiresUrlAssets ? ">=1" : "topic mode can defer concrete source pages",
    ),
    check(
      "pageCandidates",
      !requiresUrlAssets || (bundle.assets.pageCandidates?.length ?? 0) >= 1,
      bundle.assets.pageCandidates?.length ?? 0,
      requiresUrlAssets ? ">=1" : "topic mode can defer page candidates",
    ),
    check(
      "scoredAssets",
      !requiresUrlAssets || (bundle.assets.scoredCandidates?.length ?? 0) >= 1,
      bundle.assets.scoredCandidates?.length ?? 0,
      requiresUrlAssets ? ">=1" : "topic mode can defer scored assets",
    ),
    check(
      "selectedWebsiteDemoAsset",
      !requiresUrlAssets || Boolean(bundle.assets.selectedAssets?.websiteDemoPage),
      Boolean(bundle.assets.selectedAssets?.websiteDemoPage),
      requiresUrlAssets ? true : "topic mode can defer website demo asset",
    ),
    ...REQUIRED_CHECKS.map((name) => {
      const validationCheck = bundle.validation.checks.find((item) => item.name === name);
      return check(`validation:${name}`, Boolean(validationCheck?.passed), validationCheck?.actual, "passed");
    }),
  ];

  const readiness: MvpReadiness = {
    schemaVersion: 1,
    inspectedAt: new Date().toISOString(),
    outputDir,
    ready: checks.every((item) => item.passed),
    summary: {
      finalVideo: bundle.run.finalVideo,
      durationSeconds: bundle.validation.metadata.durationSeconds,
      renderMode: bundle.run.renderMode,
      voiceProvider: bundle.run.summary.voiceProvider,
      sceneCount: bundle.run.summary.sceneCount,
      captionCount: bundle.captions.length,
      researchSourcePageCount: bundle.run.summary.researchSourcePageCount,
      pageCandidateCount: bundle.assets.pageCandidates?.length ?? 0,
      scoredCandidateCount: bundle.assets.scoredCandidates?.length ?? 0,
      contentQualityPassed: bundle.contentQuality.passed,
    },
    checks,
    deferred: [
      {
        item: "HyperFrames 高级网站转视频",
        reason: "当前已支持网页类 scene、截图滚动和缺素材跳过；更精细的 DOM 区域识别和真实录屏仍可后续优化。",
        targetVersion: "post v1.4",
      },
      {
        item: "复杂后台和审核界面",
        reason: "当前个人使用优先 CLI + Codex，产品化已暂缓。",
        targetVersion: "v1.5 optional",
      },
    ],
  };

  await writeJson(join(outputDir, "mvp-readiness.json"), readiness);
  return readiness;
}

function requiredScenesFor(videoType: VideoType): SceneType[] {
  if (videoType === "tutorial") {
    return ["HOOK", "LANDING_PAGE_DEMO", "PRODUCT_PAGE_SCROLL", "WORKFLOW", "CTA"];
  }
  if (videoType === "comparison") {
    return ["HOOK", "COMPARISON", "WORKFLOW", "RECOMMENDATION", "CTA"];
  }
  if (videoType === "top_list") {
    return ["HOOK", "TOOL_LIST", "WORKFLOW", "RECOMMENDATION", "CTA"];
  }
  if (videoType === "website_demo") {
    return ["HOOK", "LANDING_PAGE_DEMO", "PRODUCT_PAGE_SCROLL", "CTA"];
  }
  if (videoType === "update_news") {
    return ["HOOK", "WEBSITE_DEMO", "FEATURE", "WORKFLOW", "CTA"];
  }
  return ["HOOK", "WEBSITE_DEMO", "SELLING_POINT", "CTA"];
}

async function readArtifacts(outputDir: string): Promise<ArtifactBundle> {
  const [run, validation, contentQuality, assets, captions, scenes] = await Promise.all([
    readJson<RunManifest>(join(outputDir, "run.json")),
    readJson<OutputValidation>(join(outputDir, "validation.json")),
    readJson<ContentQualityReport>(join(outputDir, "content-quality.json")),
    readJson<AssetData>(join(outputDir, "assets.json")),
    readJson<Caption[]>(join(outputDir, "captions.json")),
    readJson<PlannedScene[]>(join(outputDir, "scenes.json")),
  ]);
  return { run, validation, contentQuality, assets, captions, scenes };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function hasScene(scenes: PlannedScene[], sceneType: SceneType): boolean {
  return scenes.some((scene) => scene.type === sceneType);
}

async function requiredFilesPresent(outputDir: string): Promise<boolean> {
  const results = await Promise.all(
    REQUIRED_FILES.map(async (file) => {
      try {
        await access(join(outputDir, file));
        return true;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}

function check(
  name: string,
  passed: boolean,
  actual?: string | number | boolean,
  expected?: string | number | boolean,
): OutputValidationCheck {
  return { name, passed, actual, expected };
}
