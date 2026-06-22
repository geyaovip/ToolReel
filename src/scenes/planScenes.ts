import type { AssetData, CreativeBrief, PlannedScene, ScriptData } from "../types.ts";
import { slugify } from "../utils/slug.ts";

const DEFAULT_DURATIONS: Record<string, number> = {
  HOOK: 6,
  PROBLEM: 6,
  WEBSITE_DEMO: 8,
  LANDING_PAGE_DEMO: 8,
  PRODUCT_PAGE_SCROLL: 9,
  SELLING_POINT: 8,
  FEATURE: 7,
  WORKFLOW: 7,
  TARGET_USER: 6,
  TOOL_LIST: 8,
  COMPARISON: 8,
  RECOMMENDATION: 7,
  CTA: 6,
};

export function planScenes(script: ScriptData, creative?: CreativeBrief, assets?: AssetData): PlannedScene[] {
  const sceneTypeCounts = countSceneIds(script);
  const seenSceneIds = new Map<string, number>();
  const planned = script.segments.map((segment, index) => ({
    index: index + 1,
    id: uniqueSceneId(segment.sceneType, sceneTypeCounts, seenSceneIds),
    type: segment.sceneType,
    title: segment.title,
    narration: segment.narration,
    bullets: displayBullets(segment.bullets ?? [], sceneGuidance(script, creative, segment).onScreenFocus),
    ...sceneGuidance(script, creative, segment),
    assetSelection: selectSceneAsset(segment.sceneType, assets),
    duration: durationFor(segment),
  }));
  const total = planned.reduce((sum, scene) => sum + scene.duration, 0);
  if (total >= 40) {
    return planned;
  }

  const extra = 40 - total;
  return planned.map((scene, index) =>
    index === planned.length - 1 ? { ...scene, duration: scene.duration + extra } : scene,
  );
}

function countSceneIds(script: ScriptData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const segment of script.segments) {
    const id = baseSceneId(segment.sceneType);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function uniqueSceneId(
  sceneType: ScriptData["segments"][number]["sceneType"],
  counts: Map<string, number>,
  seen: Map<string, number>,
): string {
  const base = baseSceneId(sceneType);
  if ((counts.get(base) ?? 0) <= 1) {
    return base;
  }

  const next = (seen.get(base) ?? 0) + 1;
  seen.set(base, next);
  return `${base}-${next}`;
}

function baseSceneId(sceneType: ScriptData["segments"][number]["sceneType"]): string {
  return slugify(sceneType.replaceAll("_", "-"));
}

function selectSceneAsset(sceneType: ScriptData["segments"][number]["sceneType"], assets: AssetData | undefined) {
  const selected =
    sceneType === "WEBSITE_DEMO" || sceneType === "LANDING_PAGE_DEMO"
      ? assets?.selectedAssets?.websiteDemoPage
      : sceneType === "PRODUCT_PAGE_SCROLL"
        ? assets?.selectedAssets?.featurePage ?? assets?.selectedAssets?.websiteDemoPage
      : sceneType === "FEATURE" || sceneType === "SELLING_POINT"
        ? assets?.selectedAssets?.featurePage
        : sceneType === "WORKFLOW" || sceneType === "TARGET_USER"
          ? assets?.selectedAssets?.workflowPage
          : undefined;

  if (!selected) {
    if (
      assets?.websiteScreenshot &&
      assets.websiteScreenshot !== "unknown" &&
      ["WEBSITE_DEMO", "LANDING_PAGE_DEMO", "PRODUCT_PAGE_SCROLL", "SELLING_POINT", "FEATURE", "WORKFLOW", "TARGET_USER"].includes(sceneType)
    ) {
      return {
        pageKind: "homepage" as const,
        label: "官网首页",
        score: 20,
        reasons: ["verified homepage screenshot"],
      };
    }
    return undefined;
  }

  return {
    pageKind: selected.kind,
    label: cleanAssetLabel(selected.label),
    score: selected.score,
    reasons: selected.reasons,
  };
}

function cleanAssetLabel(label: string | undefined): string | undefined {
  const clean = label?.replace(/\s+/g, " ").replace(/[.…]+$/g, "").trim();
  if (!clean || clean.length > 28 || /https?:\/\/|www\.|[a-z0-9-]+\.(com|ai|io|dev|app)/i.test(clean)) {
    return undefined;
  }
  return clean;
}

function sceneGuidance(
  script: ScriptData,
  creative: CreativeBrief | undefined,
  segment: ScriptData["segments"][number],
) {
  const beat = creative?.sceneBeats.find((item) => item.sceneType === segment.sceneType);
  if (!beat) {
    return defaultSceneGuidance(script, segment);
  }

  return {
    intent: beat.intent,
    visualFocus: beat.visualFocus,
    onScreenFocus: beat.onScreenFocus,
  };
}

function defaultSceneGuidance(script: ScriptData, segment: ScriptData["segments"][number]) {
  const firstBullets = (segment.bullets ?? []).slice(0, 2);
  const onScreenFocus = firstBullets.length ? firstBullets : [segment.title, script.coreSellingPoint];

  if (segment.sceneType === "FEATURE") {
    return {
      intent: "补充一个能帮助用户判断的关键细节",
      visualFocus: "关键细节、适用判断",
      onScreenFocus,
    };
  }

  if (segment.sceneType === "LANDING_PAGE_DEMO" || segment.sceneType === "PRODUCT_PAGE_SCROLL") {
    return {
      intent: "展示真实网页现场，帮助用户快速判断产品定位和核心能力",
      visualFocus: segment.sceneType === "LANDING_PAGE_DEMO" ? "官网首屏、定位信息" : "页面滚动、功能区域",
      onScreenFocus,
    };
  }

  if (segment.sceneType === "TOOL_LIST") {
    return {
      intent: "说明榜单筛选标准，不做无证据排名",
      visualFocus: "筛选标准、场景分类",
      onScreenFocus,
    };
  }

  if (segment.sceneType === "COMPARISON" || segment.sceneType === "RECOMMENDATION") {
    return {
      intent: "帮助用户按任务和场景做选择",
      visualFocus: "对比维度、适用场景、推荐判断",
      onScreenFocus,
    };
  }

  return {
    intent: "围绕本段口播补充画面重点",
    visualFocus: "核心信息、画面重点",
    onScreenFocus,
  };
}

function displayBullets(segmentBullets: string[], onScreenFocus: string[] | undefined): string[] {
  const merged = [...(onScreenFocus ?? []), ...segmentBullets];
  const seen = new Set<string>();
  return merged
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => {
      if (!item || item.length > 34 || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    })
    .slice(0, 4);
}

function durationFor(segment: ScriptData["segments"][number]): number {
  const base = DEFAULT_DURATIONS[segment.sceneType] ?? 6;
  const narrationDuration = Math.ceil(segment.narration.length / 9);
  const bulletDuration = Math.min(3, Math.ceil((segment.bullets?.length ?? 0) / 2));
  return Math.max(5, Math.min(10, Math.max(base, narrationDuration + bulletDuration)));
}
