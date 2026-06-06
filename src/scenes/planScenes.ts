import type { PlannedScene, ScriptData } from "../types.ts";
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

export function planScenes(script: ScriptData): PlannedScene[] {
  const planned = script.segments.map((segment, index) => ({
    index: index + 1,
    id: slugify(segment.sceneType.replaceAll("_", "-")),
    type: segment.sceneType,
    title: segment.title,
    narration: segment.narration,
    bullets: segment.bullets ?? [],
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

function durationFor(segment: ScriptData["segments"][number]): number {
  const base = DEFAULT_DURATIONS[segment.sceneType] ?? 6;
  const narrationDuration = Math.ceil(segment.narration.length / 9);
  const bulletDuration = Math.min(3, Math.ceil((segment.bullets?.length ?? 0) / 2));
  return Math.max(5, Math.min(10, Math.max(base, narrationDuration + bulletDuration)));
}
