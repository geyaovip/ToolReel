import type { AssetData, ScriptData } from "../types.ts";
import { FONT_FILE, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import { escapeDrawText } from "../utils/text.ts";

function draw(text: string, y: number, size: number): string {
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=(w-text_w)/2:y=${y}:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.28:boxborderw=24`;
}

export async function generateCover(
  script: ScriptData,
  _assets: AssetData,
  outputPath: string,
): Promise<string> {
  const filter = [
    `color=c=0x08111f:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1:r=1`,
    "format=yuv420p",
    "drawbox=x=80:y=96:w=920:h=10:color=0x8df5c5@0.96:t=fill",
    "drawbox=x=112:y=360:w=856:h=640:color=white@0.08:t=fill",
    draw(script.toolName, 520, 92),
    draw(script.coreSellingPoint, 700, 48),
    draw("AI 工具种草", 1210, 56),
  ].join(",");

  await runFfmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", outputPath]);
  return outputPath;
}
