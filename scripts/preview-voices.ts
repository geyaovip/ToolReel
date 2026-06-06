import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateMiniMaxVoice, getMiniMaxTtsConfig } from "../src/tts/minimaxTts.ts";
import { loadDotEnv } from "../src/utils/env.ts";
import { slugify } from "../src/utils/slug.ts";
import { todayId } from "../src/utils/time.ts";
import type { ScriptData } from "../src/types.ts";

const recommendedMaleVoices = [
  "Chinese (Mandarin)_Radio_Host",
  "Chinese (Mandarin)_Male_Announcer",
  "Chinese (Mandarin)_Reliable_Executive",
  "male-qn-jingying",
];

const defaultText =
  "这是一段 ToolReel 的工具种草旁白测试。节奏要干净，信息密度高，适合科技媒体短视频。";

async function main(): Promise<void> {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const config = getMiniMaxTtsConfig();

  if (!config) {
    throw new Error("MINIMAX_API_KEY is required. Put it in .env or export it before running preview.");
  }

  const voices = args.voices?.length ? args.voices : recommendedMaleVoices;
  const text = args.text || defaultText;
  const outputDir = args.outputDir || join("outputs", "voice-previews", todayId());
  await mkdir(outputDir, { recursive: true });

  const script = buildPreviewScript(text);

  for (const voiceId of voices) {
    const outputPath = join(outputDir, `${slugify(voiceId)}.mp3`);
    const voice = await generateMiniMaxVoice(script, outputPath, { ...config, voiceId });
    console.log(`${voice.voiceId}: ${voice.outputPath}`);
  }

  console.log(`Voice previews written to ${outputDir}`);
}

function parseArgs(args: string[]): { voices?: string[]; text?: string; outputDir?: string } {
  const parsed: { voices?: string[]; text?: string; outputDir?: string } = {};

  for (const arg of args) {
    const [key, value] = arg.split("=", 2);
    if (!value) {
      continue;
    }

    if (key === "--voices") {
      parsed.voices = value
        .split(",")
        .map((voice) => voice.trim())
        .filter(Boolean);
    }

    if (key === "--text") {
      parsed.text = value;
    }

    if (key === "--output") {
      parsed.outputDir = value;
    }
  }

  return parsed;
}

function buildPreviewScript(text: string): ScriptData {
  return {
    toolName: "ToolReel",
    videoType: "product_pick",
    hook: "voice preview",
    coreSellingPoint: "voice preview",
    segments: [
      {
        sceneType: "HOOK",
        title: "Voice Preview",
        narration: text,
      },
    ],
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
