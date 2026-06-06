import { runFfmpeg } from "../utils/ffmpeg.ts";
import type { ScriptData, VoiceData } from "../types.ts";

export async function generateMockVoice(
  script: ScriptData,
  outputPath: string,
  fallbackReason?: string,
): Promise<VoiceData> {
  const totalDuration = script.segments.reduce(
    (sum, segment) => sum + Math.max(4, Math.min(8, Math.ceil(segment.narration.length / 8))),
    0,
  );

  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=420:duration=${totalDuration}:sample_rate=48000`,
    "-filter:a",
    "volume=0.035",
    "-codec:a",
    "libmp3lame",
    outputPath,
  ]);

  return {
    provider: "mock",
    outputPath,
    textLength: script.segments.map((segment) => segment.narration).join("").length,
    durationSeconds: totalDuration,
    fallbackReason,
  };
}
