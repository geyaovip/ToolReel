import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import type { ScriptData, VoiceData } from "../types.ts";

const DEFAULT_LOCAL_VOICE = "Reed (中文（中国大陆）)";
const DEFAULT_LOCAL_RATE = "185";

export async function generateLocalSayVoice(
  script: ScriptData,
  outputPath: string,
  fallbackReason?: string,
): Promise<VoiceData> {
  const tempDir = await mkdtemp(join(tmpdir(), "toolreel-voice-"));
  const textPath = join(tempDir, "narration.txt");
  const aiffPath = join(tempDir, "voice.aiff");
  const text = buildNarrationText(script);
  const voiceId = process.env.TOOLREEL_LOCAL_TTS_VOICE?.trim() || DEFAULT_LOCAL_VOICE;
  const rate = process.env.TOOLREEL_LOCAL_TTS_RATE?.trim() || DEFAULT_LOCAL_RATE;

  await writeFile(textPath, text, "utf8");
  await runSay([
    "-v",
    voiceId,
    "-r",
    rate,
    "-o",
    aiffPath,
    "-f",
    textPath,
  ]);

  await runFfmpeg([
    "-i",
    aiffPath,
    "-codec:a",
    "libmp3lame",
    "-ar",
    "48000",
    "-b:a",
    "128k",
    outputPath,
  ]);

  return {
    provider: "local_say",
    outputPath,
    textLength: text.length,
    voiceId,
    fallbackReason,
  };
}

function buildNarrationText(script: ScriptData): string {
  return script.segments
    .map((segment) => segment.narration.trim())
    .filter(Boolean)
    .join("\n");
}

function runSay(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("say", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`macOS say failed with code ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
