import type { CreativeBrief, PlannedScene, ScriptData } from "../types.ts";
import { slugify } from "../utils/slug.ts";

const DEFAULT_DURATIONS: Record<string, number> = {
  HOOK: 6,
  PROBLEM: 6,
  WEBSITE_DEMO: 8,
  SELLING_POINT: 8,
  FEATURE: 7,
  WORKFLOW: 7,
  TARGET_USER: 6,
  CTA: 6,
};

export function planScenes(script: ScriptData, creative?: CreativeBrief): PlannedScene[] {
  const planned = script.segments.map((segment, index) => ({
    index: index + 1,
    id: slugify(segment.sceneType.replaceAll("_", "-")),
    type: segment.sceneType,
    title: segment.title,
    narration: segment.narration,
    bullets: displayBullets(segment.bullets ?? [], sceneGuidance(script, creative, segment).onScreenFocus),
    ...sceneGuidance(script, creative, segment),
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

function sceneGuidance(
  script: ScriptData,
  creative: CreativeBrief | undefined,
  segment: ScriptData["segments"][number],
) {
  const beat = creative?.sceneBeats.find((item) => item.sceneType === segment.sceneType);
  if (!beat) {
    return fallbackSceneGuidance(script, segment);
  }

  return {
    intent: beat.intent,
    visualFocus: beat.visualFocus,
    onScreenFocus: beat.onScreenFocus,
  };
}

function fallbackSceneGuidance(script: ScriptData, segment: ScriptData["segments"][number]) {
  const firstBullets = (segment.bullets ?? []).slice(0, 2);
  const onScreenFocus = firstBullets.length ? firstBullets : [segment.title, script.coreSellingPoint];

  if (segment.sceneType === "FEATURE") {
    return {
      intent: "补充一个能帮助用户判断的关键细节",
      visualFocus: "关键细节、适用判断",
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
