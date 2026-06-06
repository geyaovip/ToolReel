import type { Caption, PlannedScene, VoiceData } from "../types.ts";

const FPS = 30;
const MIN_SCENE_FRAMES = 4 * FPS;
const PREFERRED_CAPTION_MAX = 18;
const HARD_CAPTION_MAX = 22;

export function fitSceneDurationsToVoice(scenes: PlannedScene[], voice: VoiceData): PlannedScene[] {
  if (!voice.durationSeconds || !Number.isFinite(voice.durationSeconds)) {
    return scenes;
  }

  const totalFrames = Math.max(Math.ceil(voice.durationSeconds * FPS), scenes.length * MIN_SCENE_FRAMES);
  const weights = scenes.map((scene) => narrationWeight(scene.narration));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || scenes.length;
  const fixedMinFrames = scenes.length * MIN_SCENE_FRAMES;
  const flexibleFrames = Math.max(0, totalFrames - fixedMinFrames);
  const rawFrames = weights.map((weight) => MIN_SCENE_FRAMES + (flexibleFrames * weight) / totalWeight);
  const baseFrames = rawFrames.map(Math.floor);
  let remainingFrames = totalFrames - baseFrames.reduce((sum, frames) => sum + frames, 0);
  const order = rawFrames
    .map((frames, index) => ({ index, remainder: frames - Math.floor(frames) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const item of order) {
    if (remainingFrames <= 0) {
      break;
    }
    baseFrames[item.index] += 1;
    remainingFrames -= 1;
  }

  return scenes.map((scene, index) => ({
    ...scene,
    duration: roundTime(baseFrames[index] / FPS),
  }));
}

export async function generateCaptions(scenes: PlannedScene[]): Promise<Caption[]> {
  const captions: Caption[] = [];
  let cursor = 0;

  for (const scene of scenes) {
    const chunks = splitCaptionText(scene.narration);
    const weights = chunks.map(narrationWeight);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || chunks.length;
    let localCursor = cursor;

    chunks.forEach((text, index) => {
      const start = roundTime(localCursor);
      const duration = (scene.duration * weights[index]) / totalWeight;
      const end = roundTime(index === chunks.length - 1 ? cursor + scene.duration : localCursor + duration);
      captions.push({
        start,
        end,
        text,
        sceneId: scene.id,
        sceneIndex: scene.index,
      });
      localCursor = end;
    });

    cursor += scene.duration;
  }

  return captions;
}

export function captionsToSrt(captions: Caption[]): string {
  return `${captions
    .map((caption, index) =>
      [
        String(index + 1),
        `${formatSrtTime(caption.start)} --> ${formatSrtTime(caption.end)}`,
        caption.text,
      ].join("\n"),
    )
    .join("\n\n")}\n`;
}

function splitCaptionText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const punctuationChunks = normalized
    .split(/(?<=[。！？!?；;，,、])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const semanticChunks = punctuationChunks.length > 1 ? punctuationChunks : splitBySemanticBoundaries(normalized);
  return mergeShortChunks(
    mergeDanglingPunctuation(
      semanticChunks.flatMap((chunk) => chunkByLength(chunk, PREFERRED_CAPTION_MAX)),
    ),
  );
}

function chunkByLength(text: string, maxChars: number): string[] {
  if (visualLength(text) <= HARD_CAPTION_MAX) {
    return [text];
  }

  const tokens = tokenizeCaption(text);
  const chunks: string[] = [];
  let current = "";
  let currentLength = 0;

  for (const token of tokens) {
    const tokenLength = visualLength(token);
    if (current && currentLength + tokenLength > maxChars) {
      chunks.push(current.trim());
      current = "";
      currentLength = 0;
    }
    current += token;
    currentLength += tokenLength;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [text];
}

function splitBySemanticBoundaries(text: string): string[] {
  if (visualLength(text) <= HARD_CAPTION_MAX) {
    return [text];
  }

  const pieces = text
    .split(/(?=以及|尤其适合|再|就能|但|不过|所以|然后|同时|另外|并)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (pieces.length <= 1) {
    return [text];
  }

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current ? `${current}${piece}` : piece;
    if (current && visualLength(candidate) > HARD_CAPTION_MAX) {
      chunks.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function tokenizeCaption(text: string): string[] {
  return text.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\s+|./g) ?? [text];
}

function mergeDanglingPunctuation(chunks: string[]): string[] {
  const merged: string[] = [];
  for (const chunk of chunks) {
    if (/^[。！？!?；;，,、：:]$/.test(chunk) && merged.length) {
      merged[merged.length - 1] += chunk;
      continue;
    }
    if (!/^[。！？!?；;，,、：:]$/.test(chunk)) {
      merged.push(chunk);
    }
  }
  return merged.length ? merged : chunks;
}

function mergeShortChunks(chunks: string[]): string[] {
  const merged: string[] = [];
  for (const chunk of chunks) {
    if (visualLength(chunk) < 4 && merged.length) {
      merged[merged.length - 1] += chunk;
      continue;
    }
    merged.push(chunk);
  }
  return merged;
}

function narrationWeight(text: string): number {
  const normalized = text.trim();
  return Math.max(1, visualLength(normalized) + punctuationPauseWeight(normalized));
}

function visualLength(text: string): number {
  let length = 0;
  for (const token of tokenizeCaption(text)) {
    if (/^\s+$/.test(token)) {
      length += 0.3;
    } else if (/^[A-Za-z0-9._-]+$/.test(token)) {
      length += Math.max(1, token.length * 0.62);
    } else {
      length += 1;
    }
  }
  return length;
}

function punctuationPauseWeight(text: string): number {
  const pauses = text.match(/[。！？!?；;：:，,、]/g) ?? [];
  return pauses.length * 1.2;
}

function roundTime(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatSrtTime(value: number): string {
  const totalMilliseconds = Math.max(0, Math.round(value * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(milliseconds).padStart(3, "0")}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
