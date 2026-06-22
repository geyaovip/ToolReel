import type {
  Caption,
  CoverData,
  OutputValidation,
  OutputValidationCheck,
  ScriptData,
  VoiceData,
} from "../types.ts";
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

export async function validateProductionQuality({
  finalVideo,
  validation,
  captions,
  cover,
  voice,
  script,
}: {
  finalVideo: string;
  validation: OutputValidation;
  captions: Caption[];
  cover: CoverData;
  voice: VoiceData;
  script: ScriptData;
}): Promise<OutputValidationCheck[]> {
  const audioStats = await inspectAudio(finalVideo);
  const duration = validation.metadata.durationSeconds ?? 0;
  const lastCaptionEnd = captions.at(-1)?.end ?? 0;
  const captionText = captions.map((caption) => caption.text);
  const shortReadableCaptions = captions.filter(
    (caption) => caption.end - caption.start < minReadableDuration(caption.text),
  );
  const longCaptions = captionText.filter((text) => visualLength(text) > 22);

  return [
    check("audioNotSilent", audioStats.maxVolume > -45, audioStats.maxVolume, "max volume > -45dB"),
    check("audioHasVoiceLevel", audioStats.meanVolume > -36, audioStats.meanVolume, "mean volume > -36dB"),
    check("voiceProviderIsReal", voice.provider === "minimax", voice.provider, "configured real TTS provider"),
    check(
      "captionTimelineMatchesVideo",
      Boolean(duration && Math.abs(lastCaptionEnd - duration) <= 0.8),
      `captionEnd=${lastCaptionEnd}, video=${duration}`,
      "within 0.8s",
    ),
    check("captionLengthLimit", longCaptions.length === 0, longCaptions.join(" | ") || "none", "<=22 visual chars"),
    check(
      "captionReadableDuration",
      shortReadableCaptions.length === 0,
      shortReadableCaptions.map((caption) => `${caption.text}:${caption.end - caption.start}s`).join(" | ") || "ok",
      "duration >= reading estimate",
    ),
    check("coverIdeasCount", cover.ideas.length >= 2 && cover.ideas.length <= 3, cover.ideas.length, "2-3"),
    check(
      "coverSelectedRelevant",
      coverTitleIsRelevant(cover.selected.title, script),
      cover.selected.title,
      "script tool name, hook title, or creative cover title",
    ),
    check(
      "coverTextComplete",
      [cover.selected.title, cover.selected.subtitle].every((value) => Boolean(value.trim()) && !/[.…]{2,}$/.test(value)),
      `${cover.selected.title} / ${cover.selected.subtitle}`,
      "non-empty complete text; rendered cover layout audit must pass",
    ),
  ];
}

function coverTitleIsRelevant(title: string, script: ScriptData): boolean {
  const candidates = [
    script.toolName,
    script.creative?.coverTitle,
    script.segments.find((segment) => segment.sceneType === "HOOK")?.title,
    `${script.toolName} 怎么用`,
    `${script.toolName} 值得试吗`,
    `${script.toolName} 怎么选`,
  ].filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => candidate.includes(title) || title.includes(candidate));
}

async function inspectAudio(videoPath: string): Promise<{ meanVolume: number; maxVolume: number }> {
  const ffmpegPath = await resolveFfmpegPath();
  const result = await runCommandCapture(ffmpegPath, [
    "-hide_banner",
    "-i",
    videoPath,
    "-af",
    "volumedetect",
    "-vn",
    "-f",
    "null",
    "-",
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  return {
    meanVolume: Number(text.match(/mean_volume:\s*(-?[0-9.]+)\s*dB/)?.[1] ?? -99),
    maxVolume: Number(text.match(/max_volume:\s*(-?[0-9.]+)\s*dB/)?.[1] ?? -99),
  };
}

function minReadableDuration(text: string): number {
  return Math.max(0.9, Math.min(2.6, visualLength(text) / 8));
}

function visualLength(text: string): number {
  let length = 0;
  for (const token of text.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\s+|./g) ?? [text]) {
    if (/^\s+$/.test(token)) {
      length += 0.3;
    } else if (/^[A-Za-z0-9._-]+$/.test(token)) {
      length += Math.max(1, token.length * 0.62);
    } else {
      length += 1;
    }
  }
  return Math.round(length * 10) / 10;
}
