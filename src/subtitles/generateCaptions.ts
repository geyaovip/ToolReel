import type { Caption, PlannedScene } from "../types.ts";

export async function generateCaptions(scenes: PlannedScene[]): Promise<Caption[]> {
  const captions: Caption[] = [];
  let cursor = 0;

  for (const scene of scenes) {
    const chunks = splitCaptionText(scene.narration);
    const chunkDuration = scene.duration / chunks.length;

    chunks.forEach((text, index) => {
      const start = roundTime(cursor + index * chunkDuration);
      const end = roundTime(index === chunks.length - 1 ? cursor + scene.duration : start + chunkDuration);
      captions.push({
        start,
        end,
        text,
        sceneId: scene.id,
        sceneIndex: scene.index,
      });
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
  const normalized = text.replace(/\s+/g, "");
  const punctuationChunks = normalized
    .split(/(?<=[。！？!?；;])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const chunks = punctuationChunks.length > 1 ? punctuationChunks : chunkByLength(normalized, 18);
  return chunks.flatMap((chunk) => chunkByLength(chunk, 22)).slice(0, 4);
}

function chunkByLength(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxChars) {
    chunks.push(text.slice(index, index + maxChars));
  }
  return chunks.length ? chunks : [text];
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
