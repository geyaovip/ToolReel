import type { AssetData, CoverData, ScriptData } from "../types.ts";
import { FONT_FILE, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import { displayLines, escapeDrawText } from "../utils/text.ts";

function drawAt(
  text: string,
  x: number,
  y: number,
  size: number,
  color = "white",
  boxAlpha = 0,
  border = 0,
): string {
  const box = boxAlpha > 0 ? `:box=1:boxcolor=black@${boxAlpha}:boxborderw=${border}` : "";
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}${box}`;
}

function drawHeadlineLines(text: string, x: number, y: number, size: number, charsPerLine: number): string[] {
  return displayLines(cleanCoverText(text), charsPerLine, 2).flatMap((line, index) => {
    const lineY = y + index * Math.round(size * 1.08);
    return [
      drawAt(line, x + 5, lineY + 6, size, "black@0.62"),
      drawAt(line, x, lineY, size, index === 0 ? "0xfff4a8" : "white"),
    ];
  });
}

function drawCaptionLines(
  text: string,
  x: number,
  y: number,
  size: number,
  charsPerLine: number,
  maxLines: number,
  color = "white",
): string[] {
  return displayLines(cleanCoverText(text), charsPerLine, maxLines).map((line, index) =>
    drawAt(line, x, y + index * Math.round(size * 1.24), size, color),
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
    title: coverTitle(script),
    subtitle: coverSubtitle(script),
    rationale: "自动选择默认封面方案。",
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    selected,
    ideas: [
      selected,
      {
        title: cleanCoverText(`${script.toolName} 值得试吗`, 18),
        subtitle: "看完再决定",
        rationale: "科普型封面，用于快速建立产品认知。",
      },
      {
        title: cleanCoverText(`${script.toolName} 怎么用`, 18),
        subtitle: "关键看场景",
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
  const title = coverTitle(script);
  const subtitle = coverSubtitle(script);
  const verdict = coverVerdict(script);
  const chip = script.videoType === "comparison" ? "AI工具对比" : script.videoType === "tutorial" ? "快速上手" : "AI工具科普";
  const sceneHint = cleanCoverText(script.segments.find((segment) => segment.sceneType === "WORKFLOW")?.title ?? "适合谁用", 18);
  const filter = [
    `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},boxblur=14:2,eq=brightness=-0.28:saturation=1.15[bg]`,
    `[0:v]scale=860:620:force_original_aspect_ratio=increase,crop=860:620,eq=brightness=0.14:contrast=1.18:saturation=1.18,unsharp=5:5:1.05[shot]`,
    "[bg][shot]overlay=x=150:y=870",
    "drawbox=x=0:y=0:w=1080:h=1920:color=0x07111f@0.42:t=fill",
    "drawbox=x=68:y=96:w=944:h=1420:color=black@0.22:t=fill",
    "drawbox=x=102:y=142:w=244:h=64:color=0xffd84d@1:t=fill",
    "drawbox=x=364:y=142:w=220:h=64:color=0x8df5c5@0.95:t=fill",
    "drawbox=x=118:y=820:w=844:h=684:color=white@0.16:t=fill",
    "drawbox=x=134:y=836:w=812:h=652:color=black@0.22:t=fill",
    "drawbox=x=128:y=830:w=824:h=664:color=0xffd84d@0.92:t=6",
    "drawbox=x=86:y=1540:w=908:h=132:color=0xffd84d@0.96:t=fill",
    drawAt(chip, 132, 158, 34, "black"),
    drawAt("真实体验", 394, 158, 34, "black"),
    ...drawHeadlineLines(title, 86, 286, title.length > 12 ? 92 : 108, 8),
    ...drawCaptionLines(subtitle, 96, 560, subtitle.length > 16 ? 48 : 56, 13, 2, "white"),
    drawAt(verdict, 128, 1588, verdict.length > 12 ? 58 : 68, "black"),
    ...drawCaptionLines(sceneHint, 126, 1722, 42, 14, 1, "white@0.86"),
  ].join(",");

  await runFfmpeg(["-y", "-i", screenshotPath, "-filter_complex", filter, "-frames:v", "1", outputPath]);
}

async function generateFallbackCover(script: ScriptData, outputPath: string): Promise<void> {
  const title = coverTitle(script);
  const subtitle = coverSubtitle(script);
  const verdict = coverVerdict(script);
  const chip = script.videoType === "comparison" ? "AI工具对比" : script.videoType === "tutorial" ? "快速上手" : "AI工具科普";
  const filter = [
    `color=c=0x08111f:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1:r=1`,
    "format=yuv420p",
    "drawbox=x=0:y=0:w=1080:h=1920:color=0x102842@0.72:t=fill",
    "drawbox=x=92:y=136:w=250:h=66:color=0xffd84d@1:t=fill",
    "drawbox=x=92:y=820:w=896:h=520:color=white@0.10:t=fill",
    "drawbox=x=124:y=872:w=832:h=96:color=black@0.48:t=fill",
    "drawbox=x=124:y=1008:w=832:h=96:color=black@0.38:t=fill",
    "drawbox=x=124:y=1144:w=832:h=96:color=black@0.30:t=fill",
    "drawbox=x=96:y=1518:w=888:h=136:color=0xffd84d@0.96:t=fill",
    drawAt(chip, 126, 154, 36, "black"),
    ...drawHeadlineLines(title, 92, 310, title.length > 12 ? 92 : 108, 8),
    ...drawCaptionLines(subtitle, 104, 594, subtitle.length > 16 ? 48 : 56, 13, 2, "white"),
    drawAt("1  先看筛选标准", 162, 892, 48, "0x8df5c5"),
    drawAt("2  再看真实场景", 162, 1028, 48, "white"),
    drawAt("3  最后决定要不要试", 162, 1164, 48, "white"),
    drawAt(verdict, 132, 1568, verdict.length > 12 ? 58 : 68, "black"),
  ].join(",");

  await runFfmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", outputPath]);
}

function coverTitle(script: ScriptData): string {
  if (script.videoType === "comparison") {
    const comparison = script.segments.find((segment) => segment.sceneType === "HOOK")?.title;
    return cleanCoverText(comparison ?? `${script.toolName} 怎么选`, 18);
  }
  if (script.videoType === "tutorial") {
    return cleanCoverText(`${script.toolName} 怎么用`, 18);
  }
  if (script.videoType === "website_demo") {
    return cleanCoverText(`${script.toolName} 官网速看`, 18);
  }
  if (script.videoType === "update_news") {
    return cleanCoverText(`${script.toolName} 更新速看`, 18);
  }
  if (script.videoType === "top_list") {
    return cleanCoverText(`${script.toolName} 怎么选`, 18);
  }
  return cleanCoverText(script.creative?.coverTitle ?? `${script.toolName} 值得试吗`, 18);
}

function coverSubtitle(script: ScriptData): string {
  if (script.videoType === "comparison") {
    return "别只看排名，先看场景";
  }
  if (script.videoType === "tutorial") {
    return "第一次使用先看这几步";
  }
  if (script.videoType === "website_demo") {
    return "一分钟抓住核心功能";
  }
  if (script.videoType === "update_news") {
    return "看变化，也看影响场景";
  }
  if (script.videoType === "top_list") {
    return "先看筛选标准";
  }
  return cleanCoverText(script.creative?.coverSubtitle ?? "一分钟讲清楚", 18);
}

function coverVerdict(script: ScriptData): string {
  if (script.videoType === "comparison") {
    return "怎么选更靠谱";
  }
  if (script.videoType === "tutorial") {
    return "直接照着试";
  }
  if (script.videoType === "website_demo") {
    return "核心功能在哪";
  }
  if (script.videoType === "update_news") {
    return "要不要跟进";
  }
  if (script.videoType === "top_list") {
    return "别收藏一堆名字";
  }
  return "值不值得试";
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
