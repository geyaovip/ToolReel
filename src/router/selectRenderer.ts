import type { RendererName, SceneType } from "../types.ts";

const HYPERFRAMES_SCENES = new Set<SceneType>([
  "WEBSITE_DEMO",
  "LANDING_PAGE_DEMO",
  "PRODUCT_PAGE_SCROLL",
]);

export function selectRenderer(sceneType: SceneType): RendererName {
  return HYPERFRAMES_SCENES.has(sceneType) ? "HyperFrames" : "Remotion";
}

