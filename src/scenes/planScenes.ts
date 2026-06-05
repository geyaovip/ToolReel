import type { PlannedScene, ScriptData } from "../types.ts";
import { slugify } from "../utils/slug.ts";

const DEFAULT_DURATIONS: Record<string, number> = {
  HOOK: 6,
  PROBLEM: 7,
  WEBSITE_DEMO: 8,
  SELLING_POINT: 8,
  TARGET_USER: 7,
  CTA: 6,
};

export function planScenes(script: ScriptData): PlannedScene[] {
  return script.segments.map((segment, index) => ({
    index: index + 1,
    id: slugify(segment.sceneType.replaceAll("_", "-")),
    type: segment.sceneType,
    title: segment.title,
    narration: segment.narration,
    bullets: segment.bullets ?? [],
    duration: DEFAULT_DURATIONS[segment.sceneType] ?? 6,
  }));
}
