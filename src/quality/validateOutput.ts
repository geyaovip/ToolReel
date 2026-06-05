import { dirname, join } from "node:path";
import { AUDIO_SAMPLE_RATE, FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import type { OutputValidation, OutputValidationCheck } from "../types.ts";
import { runCommandCapture } from "../utils/exec.ts";
import { resolveFfmpegPath, runFfmpeg } from "../utils/ffmpeg.ts";

type MediaMetadata = OutputValidation["metadata"];

function parseMetadata(stderr: string): MediaMetadata {
  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const startMatch = stderr.match(/start:\s*(-?\d+(?:\.\d+)?)/);
  const videoMatch = stderr.match(/Video:[^\n]+,\s*(\d+)x(\d+)[^\n]+,\s*(\d+(?:\.\d+)?)\s*fps/);
  const audioMatch = stderr.match(/Audio:[^\n]+,\s*(\d+)\s*Hz/);

  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : undefined;

  return {
    durationSeconds,
    startSeconds: startMatch ? Number(startMatch[1]) : undefined,
    width: videoMatch ? Number(videoMatch[1]) : undefined,
    height: videoMatch ? Number(videoMatch[2]) : undefined,
    fps: videoMatch ? Number(videoMatch[3]) : undefined,
    audioSampleRate: audioMatch ? Number(audioMatch[1]) : undefined,
  };
}

function check(
  name: string,
  passed: boolean,
  actual?: string | number | boolean,
  expected?: string | number | boolean,
): OutputValidationCheck {
  return { name, passed, actual, expected };
}

async function inspectMedia(videoPath: string): Promise<MediaMetadata> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, ["-hide_banner", "-i", videoPath]);
  return parseMetadata(result.stderr);
}

async function hasOpeningBlackFrames(videoPath: string): Promise<boolean> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, [
    "-hide_banner",
    "-t",
    "1",
    "-i",
    videoPath,
    "-vf",
    "blackdetect=d=0.02:pix_th=0.10",
    "-an",
    "-f",
    "null",
    "-",
  ]);

  return /black_start:/i.test(result.stderr);
}

export async function validateOutput(videoPath: string): Promise<OutputValidation> {
  const firstFramePath = join(dirname(videoPath), "first-frame.png");
  await runFfmpeg([
    "-ss",
    "0",
    "-i",
    videoPath,
    "-frames:v",
    "1",
    firstFramePath,
  ]);

  const metadata = await inspectMedia(videoPath);
  const openingBlackFrames = await hasOpeningBlackFrames(videoPath);
  const checks = [
    check("width", metadata.width === VIDEO_WIDTH, metadata.width, VIDEO_WIDTH),
    check("height", metadata.height === VIDEO_HEIGHT, metadata.height, VIDEO_HEIGHT),
    check("fps", metadata.fps === FPS, metadata.fps, FPS),
    check("audioSampleRate", metadata.audioSampleRate === AUDIO_SAMPLE_RATE, metadata.audioSampleRate, AUDIO_SAMPLE_RATE),
    check("startAtZero", metadata.startSeconds === 0, metadata.startSeconds, 0),
    check("durationWithinMvpRange", Boolean(metadata.durationSeconds && metadata.durationSeconds >= 40 && metadata.durationSeconds <= 75), metadata.durationSeconds, "40-75"),
    check("noOpeningBlackFrames", !openingBlackFrames, openingBlackFrames, false),
  ];

  return {
    videoPath,
    firstFramePath,
    inspectedAt: new Date().toISOString(),
    passed: checks.every((item) => item.passed),
    metadata,
    checks,
  };
}
