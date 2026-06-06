import { dirname, join } from "node:path";
import { getMiniMaxTtsConfig, generateMiniMaxVoice } from "./minimaxTts.ts";
import { generateLocalSayVoice } from "./localSayVoice.ts";
import type { ScriptData, VoiceData } from "../types.ts";
import { writeJson } from "../utils/file.ts";
import { loadDotEnv } from "../utils/env.ts";

export async function generateVoice(script: ScriptData, outputPath: string): Promise<VoiceData> {
  await loadDotEnv();
  const config = getMiniMaxTtsConfig();
  let voice: VoiceData;

  if (!config) {
    voice = await generateLocalSayVoice(script, outputPath, "MINIMAX_API_KEY is not configured");
  } else {
    try {
      voice = await generateMiniMaxVoice(script, outputPath, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown MiniMax TTS error";
      voice = await generateLocalSayVoice(script, outputPath, message);
    }
  }

  await writeJson(join(dirname(outputPath), "voice.json"), voice);
  return voice;
}
