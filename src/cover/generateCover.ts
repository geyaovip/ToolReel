import type { AssetData, ScriptData } from "../types.ts";
import { FONT_FILE, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import { escapeDrawText } from "../utils/text.ts";

function draw(text: string, y: number, size: number, color = "white", boxAlpha = 0.30): string {
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=(w-text_w)/2:y=${y}:fontsize=${size}:fontcolor=${color}:box=1:boxcolor=black@${boxAlpha}:boxborderw=24`;
}

export async function generateCover(
  script: ScriptData,
  assets: AssetData,
  outputPath: string,
): Promise<string> {
  if (assets.websiteScreenshot && assets.websiteScreenshot !== "unknown") {
    try {
      await generateCoverFromScreenshot(script, assets.websiteScreenshot, outputPath);
      return outputPath;
    } catch {
      // Fall back to a generated cover when the screenshot cannot be decoded.
    }
  }

  await generateFallbackCover(script, outputPath);
  return outputPath;
}

async function generateCoverFromScreenshot(
  script: ScriptData,
  screenshotPath: string,
  outputPath: string,
): Promise<void> {
  const subtitle = script.segments.find((segment) => segment.sceneType === "SELLING_POINT")?.title
    ?? script.coreSellingPoint;
  const title = script.creative?.coverTitle ?? script.toolName;
  const kicker = script.creative?.coverSubtitle ?? "一分钟看懂这个 AI 工具";
  const sceneHint = script.segments.find((segment) => segment.sceneType === "WORKFLOW")?.title ?? "工具科普";
  const filter = [
    `scale=w=${VIDEO_WIDTH}:h=${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
    "boxblur=10:2",
    "eq=brightness=-0.20:saturation=0.72",
    "drawbox=x=0:y=0:w=1080:h=1920:color=0x07111f@0.38:t=fill",
    "drawbox=x=80:y=112:w=920:h=10:color=0x8df5c5@0.96:t=fill",
    "drawbox=x=88:y=388:w=904:h=690:color=black@0.50:t=fill",
    "drawbox=x=112:y=420:w=190:h=58:color=0x8df5c5@0.24:t=fill",
    draw("工具科普", 432, 32, "0x8df5c5", 0.05),
    draw(title, 536, title.length > 12 ? 68 : 88),
    draw(subtitle, 720, subtitle.length > 18 ? 48 : 58),
    draw(sceneHint, 900, sceneHint.length > 16 ? 42 : 48, "white@0.86", 0.20),
    draw(kicker, 1240, kicker.length > 14 ? 50 : 58),
  ].join(",");

  await runFfmpeg(["-y", "-i", screenshotPath, "-vf", filter, "-frames:v", "1", outputPath]);
}

async function generateFallbackCover(script: ScriptData, outputPath: string): Promise<void> {
  const filter = [
    `color=c=0x08111f:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1:r=1`,
    "format=yuv420p",
    "drawbox=x=80:y=96:w=920:h=10:color=0x8df5c5@0.96:t=fill",
    "drawbox=x=112:y=360:w=856:h=640:color=white@0.08:t=fill",
    draw("工具科普", 430, 34, "0x8df5c5", 0.05),
    draw(script.creative?.coverTitle ?? script.toolName, 520, 78),
    draw(script.coreSellingPoint, 700, 48),
    draw(script.creative?.coverSubtitle ?? "一分钟讲清楚", 1210, 56),
  ].join(",");

  await runFfmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", outputPath]);
}
