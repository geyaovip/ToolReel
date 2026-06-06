import { dirname, join } from "node:path";
import { getMiniMaxTtsConfig, generateMiniMaxVoice } from "./minimaxTts.ts";
import type { ScriptData, VoiceData } from "../types.ts";
import { writeJson } from "../utils/file.ts";
import { loadDotEnv } from "../utils/env.ts";

export async function generateVoice(script: ScriptData, outputPath: string): Promise<VoiceData> {
  await loadDotEnv();
  const config = getMiniMaxTtsConfig();

  if (!config) {
    throw new Error(
      "Real TTS is required for final video audio. Configure MINIMAX_API_KEY in .env or the environment.",
    );
  }

  const voice: VoiceData = await generateMiniMaxVoice(script, outputPath, config);
  await writeJson(join(dirname(outputPath), "voice.json"), voice);
  return voice;
}
