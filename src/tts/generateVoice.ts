import { runFfmpeg } from "../utils/ffmpeg.ts";
import type { ScriptData } from "../types.ts";

export async function generateVoice(script: ScriptData, outputPath: string): Promise<string> {
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

  return outputPath;
}

