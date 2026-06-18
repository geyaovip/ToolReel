import type { AssetData, CoverData, ScriptData } from "../types.ts";
import { FONT_FILE, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import { displayLines, escapeDrawText } from "../utils/text.ts";

function draw(text: string, y: number, size: number, color = "white", boxAlpha = 0.30): string {
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=(w-text_w)/2:y=${y}:fontsize=${size}:fontcolor=${color}:box=1:boxcolor=black@${boxAlpha}:boxborderw=24`;
}

function drawLines(text: string, y: number, size: number, charsPerLine: number, maxLines: number, color = "white", boxAlpha = 0.30): string[] {
  return displayLines(cleanCoverText(text), charsPerLine, maxLines).map((line, index) =>
    draw(line, y + index * Math.round(size * 1.24), size, color, boxAlpha),
  );
}

export async function generateCover(
  script: ScriptData,
  assets: AssetData,
  outputPath: string,
): Promise<CoverData> {
  if (assets.websiteScreenshot && assets.websiteScreenshot !== "unknown") {
    try {
      await generateCoverFromScreenshot(script, assets.websiteScreenshot, outputPath);
      return coverData(script, outputPath);
    } catch {
      // Fall back to a generated cover when the screenshot cannot be decoded.
    }
  }

  await generateFallbackCover(script, outputPath);
  return coverData(script, outputPath);
}

function coverData(script: ScriptData, outputPath: string): CoverData {
  const selected = {
    title: cleanCoverText(script.creative?.coverTitle ?? script.toolName, 18),
    subtitle: cleanCoverText(script.creative?.coverSubtitle ?? "一分钟讲清楚", 18),
    rationale: "自动选择默认封面方案。",
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    selected,
    ideas: [
      selected,
      {
        title: cleanCoverText(`${script.toolName} 是干啥的`, 18),
        subtitle: "先看核心场景",
        rationale: "科普型封面，用于快速建立产品认知。",
      },
      {
        title: cleanCoverText(`${script.toolName} 值得试吗`, 18),
        subtitle: "看场景再决定",
        rationale: "判断型封面，用于强调试用决策。",
      },
    ],
    outputPath,
  };
}

async function generateCoverFromScreenshot(
  script: ScriptData,
  screenshotPath: string,
  outputPath: string,
): Promise<void> {
  const subtitle = script.segments.find((segment) => segment.sceneType === "SELLING_POINT")?.title
    ?? script.coreSellingPoint;
  const title = cleanCoverText(script.creative?.coverTitle ?? script.toolName, 18);
  const kicker = cleanCoverText(script.creative?.coverSubtitle ?? "一分钟看懂这个 AI 工具", 18);
  const sceneHint = cleanCoverText(script.segments.find((segment) => segment.sceneType === "WORKFLOW")?.title ?? "工具科普", 18);
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
    ...drawLines(title, 536, title.length > 12 ? 68 : 82, 10, 2),
    ...drawLines(subtitle, 720, subtitle.length > 18 ? 46 : 56, 13, 2),
    ...drawLines(sceneHint, 900, sceneHint.length > 16 ? 40 : 48, 14, 2, "white@0.86", 0.20),
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
    ...drawLines(script.creative?.coverTitle ?? script.toolName, 520, 72, 10, 2),
    ...drawLines(script.coreSellingPoint, 700, 44, 14, 2),
    draw(cleanCoverText(script.creative?.coverSubtitle ?? "一分钟讲清楚", 18), 1210, 56),
  ].join(",");

  await runFfmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", outputPath]);
}

function cleanCoverText(text: string, maxChars = 24): string {
  const normalized = text.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  if (visualLength(normalized) <= maxChars) {
    return normalized;
  }
  const tokens = normalized.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\s+|./g) ?? [normalized];
  let current = "";
  for (const token of tokens) {
    const candidate = `${current}${token}`.trim();
    if (candidate && visualLength(candidate) > maxChars) {
      break;
    }
    current += token;
  }
  return current.trim() || normalized;
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
