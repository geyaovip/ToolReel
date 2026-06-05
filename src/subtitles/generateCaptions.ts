import type { Caption, ScriptData } from "../types.ts";

export async function generateCaptions(script: ScriptData): Promise<Caption[]> {
  let cursor = 0;
  return script.segments.map((segment) => {
    const duration = Math.max(4, Math.min(8, Math.ceil(segment.narration.length / 8)));
    const caption = {
      start: cursor,
      end: cursor + duration,
      text: segment.narration,
    };
    cursor += duration;
    return caption;
  });
}

