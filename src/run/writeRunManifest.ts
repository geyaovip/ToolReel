import { join } from "node:path";
import type {
  AssetData,
  Caption,
  CreativeBrief,
  GenerateInput,
  OutputValidation,
  PlannedScene,
  ResearchResult,
  RunManifest,
  ScriptData,
  VoiceData,
} from "../types.ts";
import { writeJson } from "../utils/file.ts";

type WriteRunManifestArgs = {
  outputDir: string;
  finalVideo: string;
  renderMode: RunManifest["renderMode"];
  input: GenerateInput;
  research: ResearchResult;
  creative: CreativeBrief;
  script: ScriptData;
  assets: AssetData;
  captions: Caption[];
  voice: VoiceData;
  scenes: PlannedScene[];
  validation: OutputValidation;
};

export async function writeRunManifest(args: WriteRunManifestArgs): Promise<RunManifest> {
  const manifest: RunManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: args.validation.passed ? "passed" : "failed",
    outputDir: args.outputDir,
    finalVideo: args.finalVideo,
    renderMode: args.renderMode,
    input: args.input,
    files: {
      input: join(args.outputDir, "input.json"),
      research: join(args.outputDir, "research.json"),
      creative: join(args.outputDir, "creative.json"),
      script: join(args.outputDir, "script.json"),
      assets: join(args.outputDir, "assets.json"),
      captions: join(args.outputDir, "captions.json"),
      captionsSrt: join(args.outputDir, "captions.srt"),
      voice: args.voice.outputPath,
      voiceMeta: join(args.outputDir, "voice.json"),
      scenes: join(args.outputDir, "scenes.json"),
      cover: join(args.outputDir, "cover.png"),
      finalVideo: args.finalVideo,
      validation: join(args.outputDir, "validation.json"),
    },
    summary: {
      toolName: args.script.toolName,
      videoType: args.script.videoType,
      durationSeconds: args.validation.metadata.durationSeconds,
      sceneCount: args.scenes.length,
      captionCount: args.captions.length,
      voiceProvider: args.voice.provider,
      assetSource: args.assets.source,
      researchSourcePageCount: args.research.sourcePages?.length ?? 0,
      unknownCount: args.research.unknowns?.length ?? 0,
    },
    checks: args.validation.checks,
    warnings: collectWarnings(args),
  };

  await writeJson(join(args.outputDir, "run.json"), manifest);
  return manifest;
}

function collectWarnings(args: WriteRunManifestArgs): string[] {
  return [
    ...(args.voice.fallbackReason ? [`Voice fallback: ${args.voice.fallbackReason}`] : []),
    ...(args.assets.notes ?? []).map((note) => `Asset note: ${note}`),
    ...(args.research.notes ?? []).map((note) => `Research note: ${note}`),
    ...(args.research.unknowns ?? []).map((unknown) => `Research unknown: ${unknown}`),
    `Creative angle: ${args.creative.selectedAngle.title}`,
    ...args.validation.checks
      .filter((check) => !check.passed)
      .map((check) => `Validation failed: ${check.name}`),
  ];
}
