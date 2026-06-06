import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ensureDir } from "../utils/file.ts";
import type { ScriptData, VoiceData } from "../types.ts";

type MiniMaxTtsConfig = {
  apiKey: string;
  endpoint: string;
  model: string;
  voiceId: string;
};

type MiniMaxTtsResponse = {
  data?: {
    audio?: string;
    status?: number;
  };
  extra_info?: {
    audio_length?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  trace_id?: string;
};

export function getMiniMaxTtsConfig(): MiniMaxTtsConfig | null {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    endpoint: process.env.MINIMAX_TTS_ENDPOINT?.trim() || "https://api.minimaxi.com/v1/t2a_v2",
    model: process.env.MINIMAX_TTS_MODEL?.trim() || "speech-2.8-hd",
    voiceId: process.env.MINIMAX_TTS_VOICE_ID?.trim() || "Chinese (Mandarin)_Radio_Host",
  };
}

export async function generateMiniMaxVoice(
  script: ScriptData,
  outputPath: string,
  config: MiniMaxTtsConfig,
): Promise<VoiceData> {
  const text = buildNarrationText(script);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      text,
      stream: false,
      language_boost: "Chinese",
      output_format: "hex",
      voice_setting: {
        voice_id: config.voiceId,
        speed: Number(process.env.MINIMAX_TTS_SPEED || 1),
        vol: Number(process.env.MINIMAX_TTS_VOLUME || 1),
        pitch: Number(process.env.MINIMAX_TTS_PITCH || 0),
      },
      audio_setting: {
        sample_rate: Number(process.env.MINIMAX_TTS_SAMPLE_RATE || 32000),
        bitrate: Number(process.env.MINIMAX_TTS_BITRATE || 128000),
        format: "mp3",
        channel: 1,
      },
      subtitle_enable: false,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax TTS HTTP ${response.status}: ${bodyText.slice(0, 240)}`);
  }

  const body = JSON.parse(bodyText) as MiniMaxTtsResponse;
  const statusCode = body.base_resp?.status_code ?? 0;
  if (statusCode !== 0) {
    throw new Error(
      `MiniMax TTS failed: ${body.base_resp?.status_msg ?? "unknown error"} (${statusCode})`,
    );
  }

  const audioHex = body.data?.audio;
  if (!audioHex) {
    throw new Error(`MiniMax TTS response missing audio data, trace_id=${body.trace_id ?? "unknown"}`);
  }

  await ensureDir(dirname(outputPath));
  await writeFile(outputPath, Buffer.from(audioHex, "hex"));

  return {
    provider: "minimax",
    outputPath,
    textLength: text.length,
    durationSeconds: body.extra_info?.audio_length
      ? Math.round((body.extra_info.audio_length / 1000) * 100) / 100
      : undefined,
    model: config.model,
    voiceId: config.voiceId,
  };
}

function buildNarrationText(script: ScriptData): string {
  return script.segments
    .map((segment) => segment.narration.trim())
    .filter(Boolean)
    .join("\n");
}
