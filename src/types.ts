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
  positioning?: string;
  highlights?: ResearchHighlight[];
  useCases?: string[];
  evidence?: ResearchEvidence[];
  sourcePages?: ResearchSourcePage[];
  unknowns?: string[];
  notes?: string[];
};

export type ResearchHighlight = {
  title: string;
  detail: string;
  sourceUrl: string;
};

export type ResearchEvidence = {
  text: string;
  sourceUrl: string;
};

export type ResearchSourcePage = {
  url: string;
  title?: string;
  description?: string;
  extractedTextLength: number;
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
  source: "auto" | "mock";
  assetsDir?: string;
  homepage?: {
    url: string;
    title?: string;
    description?: string;
    screenshotPath?: string;
  };
  logoCandidates?: AssetCandidate[];
  imageCandidates?: AssetCandidate[];
  videoCandidates?: AssetCandidate[];
  socialCandidates?: AssetCandidate[];
  quoteCandidates?: QuoteCandidate[];
  localRecordings?: AssetCandidate[];
  notes?: string[];
};

export type AssetCandidate = {
  type: "logo" | "screenshot" | "image" | "video" | "social" | "recording";
  url?: string;
  path?: string;
  label?: string;
  source: "official_site" | "manual" | "third_party";
  confidence: "high" | "medium" | "low";
};

export type QuoteCandidate = {
  quote: string;
  author?: string;
  url?: string;
  source: "manual" | "third_party";
  confidence: "high" | "medium" | "low";
};

export type Caption = {
  start: number;
  end: number;
  text: string;
  sceneId?: string;
  sceneIndex?: number;
};

export type VoiceProvider = "minimax" | "mock";

export type VoiceData = {
  provider: VoiceProvider;
  outputPath: string;
  textLength: number;
  durationSeconds?: number;
  model?: string;
  voiceId?: string;
  fallbackReason?: string;
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
  validation?: OutputValidation;
  runManifest?: RunManifest;
};

export type RunManifest = {
  schemaVersion: 1;
  generatedAt: string;
  status: "passed" | "failed";
  outputDir: string;
  finalVideo: string;
  renderMode: "Remotion" | "HyperFrames" | "Hybrid";
  input: GenerateInput;
  files: {
    input: string;
    research: string;
    script: string;
    assets: string;
    captions: string;
    captionsSrt: string;
    voice: string;
    voiceMeta: string;
    scenes: string;
    cover: string;
    finalVideo: string;
    validation: string;
  };
  summary: {
    toolName: string;
    videoType: VideoType;
    durationSeconds?: number;
    sceneCount: number;
    captionCount: number;
    voiceProvider: VoiceProvider;
    assetSource: AssetData["source"];
    researchSourcePageCount: number;
    unknownCount: number;
  };
  checks: OutputValidationCheck[];
  warnings: string[];
};

export type OutputValidationCheck = {
  name: string;
  passed: boolean;
  actual?: string | number | boolean;
  expected?: string | number | boolean;
};

export type OutputValidation = {
  videoPath: string;
  firstFramePath: string;
  inspectedAt: string;
  passed: boolean;
  metadata: {
    durationSeconds?: number;
    startSeconds?: number;
    width?: number;
    height?: number;
    fps?: number;
    audioSampleRate?: number;
  };
  checks: OutputValidationCheck[];
};
