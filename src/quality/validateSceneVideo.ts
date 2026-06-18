import type { OutputValidationCheck, SceneRenderQuality } from "../types.ts";
import { resolveFfmpegPath } from "../utils/ffmpeg.ts";
import { runCommandCapture } from "../utils/exec.ts";

function check(
  name: string,
  passed: boolean,
  actual?: string | number | boolean,
  expected?: string | number | boolean,
): OutputValidationCheck {
  return { name, passed, actual, expected };
}

export async function validateHyperFrameSceneVideo(videoPath: string): Promise<SceneRenderQuality> {
  const [blackFrames, blankStats, staticVideo] = await Promise.all([
    hasBlackFrames(videoPath),
    inspectBlankStats(videoPath),
    isMostlyStatic(videoPath),
  ]);

  const checks = [
    check("sceneNotBlack", !blackFrames, blackFrames, false),
    check(
      "sceneNotBlankWhite",
      !blankStats.isBlankWhite,
      `avgY=${blankStats.avgY}, avgSaturation=${blankStats.avgSaturation}`,
      "avgY < 245 or avgSaturation >= 3",
    ),
    check("sceneHasMotion", !staticVideo, staticVideo, false),
  ];

  return {
    checkedAt: new Date().toISOString(),
    passed: checks.every((item) => item.passed),
    checks,
  };
}

async function hasBlackFrames(videoPath: string): Promise<boolean> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, [
    "-hide_banner",
    "-i",
    videoPath,
    "-vf",
    "blackdetect=d=0.12:pix_th=0.10",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  return /black_start:/i.test(result.stderr);
}

async function inspectBlankStats(videoPath: string): Promise<{ avgY: number; avgSaturation: number; isBlankWhite: boolean }> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, [
    "-hide_banner",
    "-i",
    videoPath,
    "-vf",
    "fps=1,scale=160:-1,signalstats,metadata=print",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  const yValues = matches(text, /lavfi\.signalstats\.YAVG=([0-9.]+)/g);
  const satValues = matches(text, /lavfi\.signalstats\.SATAVG=([0-9.]+)/g);
  const avgY = average(yValues);
  const avgSaturation = average(satValues);
  return {
    avgY,
    avgSaturation,
    isBlankWhite: avgY >= 245 && avgSaturation < 3,
  };
}

async function isMostlyStatic(videoPath: string): Promise<boolean> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, [
    "-hide_banner",
    "-i",
    videoPath,
    "-vf",
    "freezedetect=n=0.003:d=2",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const freezes = result.stderr.match(/freeze_duration:\s*([0-9.]+)/gi) ?? [];
  return freezes.some((value) => Number(value.match(/([0-9.]+)$/)?.[1] ?? 0) >= 5.5);
}

function matches(text: string, pattern: RegExp): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(pattern)) {
    values.push(Number(match[1]));
  }
  return values.filter((value) => Number.isFinite(value));
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
