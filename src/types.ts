export type VideoType =
  | "product_pick"
  | "top_list"
  | "tutorial"
  | "comparison"
  | "website_demo";

export type SceneType =
  | "HOOK"
  | "PROBLEM"
  | "WEBSITE_DEMO"
  | "SELLING_POINT"
  | "FEATURE"
  | "PRICING"
  | "TARGET_USER"
  | "WORKFLOW"
  | "CTA"
  | "TOOL_LIST"
  | "COMPARISON"
  | "RECOMMENDATION"
  | "LANDING_PAGE_DEMO"
  | "PRODUCT_PAGE_SCROLL";

export type RendererName = "Remotion" | "HyperFrames";

export type GenerateInput = {
  name: string;
  url: string;
  type: VideoType;
  createdAt: string;
  outputDir: string;
};

export type ResearchResult = {
  toolName: string;
  officialUrl: string;
  summary: string;
  pricing: "unknown" | string;
  targetUsers: string[];
  sellingPoints: string[];
};

export type ScriptSegment = {
  sceneType: SceneType;
  title: string;
  narration: string;
  bullets?: string[];
};

export type ScriptData = {
  toolName: string;
  videoType: VideoType;
  hook: string;
  coreSellingPoint: string;
  segments: ScriptSegment[];
};

export type AssetData = {
  logo: string;
  websiteScreenshot: string;
  productScreenshot: string;
  source: "mock";
};

export type Caption = {
  start: number;
  end: number;
  text: string;
};

export type PlannedScene = {
  index: number;
  id: string;
  type: SceneType;
  title: string;
  narration: string;
  bullets: string[];
  duration: number;
  renderer?: RendererName;
  outputPath?: string;
};

export type PipelineResult = {
  outputDir: string;
  finalVideo: string;
  scenes: PlannedScene[];
  renderMode: "Remotion" | "HyperFrames" | "Hybrid";
};

