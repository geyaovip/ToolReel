import { spawn } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import type { AssetData, CoverData, ScriptData } from "../types.ts";
import { FONT_FILE, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { cleanupStaleBrowserProfiles, commonHeadlessChromeFlags, MACOS_CHROME_EXECUTABLE } from "../utils/browser.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";
import { ensureDir } from "../utils/file.ts";
import { displayLines, escapeDrawText } from "../utils/text.ts";

type CoverTheme = {
  background: string;
  panel: string;
  accent: string;
  accent2: string;
  ink: string;
  muted: string;
  chipText: string;
};

const THEMES: Record<ScriptData["videoType"], CoverTheme> = {
  product_pick: {
    background: "#f5f0e8",
    panel: "#111417",
    accent: "#ffdf3d",
    accent2: "#23d18b",
    ink: "#0f1115",
    muted: "#394047",
    chipText: "#111417",
  },
  tutorial: {
    background: "#f7f4ec",
    panel: "#15151a",
    accent: "#ff7a59",
    accent2: "#7df2c4",
    ink: "#101216",
    muted: "#3d434a",
    chipText: "#111417",
  },
  comparison: {
    background: "#f4f1e8",
    panel: "#10121a",
    accent: "#ffdf3d",
    accent2: "#7df2c4",
    ink: "#101216",
    muted: "#353b42",
    chipText: "#111417",
  },
  top_list: {
    background: "#f6f2e8",
    panel: "#0f1720",
    accent: "#ffdf3d",
    accent2: "#ff5f7e",
    ink: "#0c1118",
    muted: "#3a4148",
    chipText: "#111417",
  },
  website_demo: {
    background: "#eef7f4",
    panel: "#101820",
    accent: "#78f2c4",
    accent2: "#ffdf3d",
    ink: "#0d1418",
    muted: "#334148",
    chipText: "#111417",
  },
  update_news: {
    background: "#f2f0fb",
    panel: "#171225",
    accent: "#b78cff",
    accent2: "#ffdf3d",
    ink: "#111018",
    muted: "#423c50",
    chipText: "#111417",
  },
};

export async function generateCover(
  script: ScriptData,
  _assets: AssetData,
  outputPath: string,
): Promise<CoverData> {
  try {
    await generateHtmlCover(script, outputPath);
  } catch {
    await generateFallbackCover(script, outputPath);
  }
  return coverData(script, outputPath);
}

function coverData(script: ScriptData, outputPath: string): CoverData {
  const selected = {
    title: coverTitle(script),
    subtitle: coverSubtitle(script),
    rationale: "自动选择短视频信息流封面方案。",
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
        rationale: "判断型封面，用于强调试用决策。",
      },
      {
        title: cleanCoverText(`${script.toolName} 怎么用`, 18),
        subtitle: "关键看场景",
        rationale: "教程型封面，用于强调可操作性。",
      },
    ],
    outputPath,
  };
}

async function generateHtmlCover(script: ScriptData, outputPath: string): Promise<void> {
  await ensureDir(dirname(outputPath));
  await cleanupStaleBrowserProfiles();
  const htmlPath = outputPath.replace(/\.png$/i, ".html");
  await writeFile(htmlPath, coverHtml(script), "utf8");
  await captureHtml(htmlPath, outputPath);
}

function coverHtml(script: ScriptData): string {
  const theme = THEMES[script.videoType];
  const titleLines = displayLines(coverTitle(script), 9, 2);
  const subtitleLines = displayLines(coverSubtitle(script), 12, 2);
  const insightLines = coverInsights(script);
  const chip = coverChip(script);
  const verdict = coverVerdict(script);
  const visualWord = cleanCoverText(script.toolName, 20);
  const monoWord = visualWord.replace(/\s+/g, " ");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: ${VIDEO_WIDTH}px;
    height: ${VIDEO_HEIGHT}px;
    overflow: hidden;
    font-family: "PingFang SC", "Hiragino Sans GB", "Arial Unicode MS", sans-serif;
    background: ${theme.background};
    color: ${theme.ink};
  }
  .cover {
    position: relative;
    width: ${VIDEO_WIDTH}px;
    height: ${VIDEO_HEIGHT}px;
    padding: 58px 54px;
    overflow: hidden;
  }
  .cover::before {
    content: "";
    position: absolute;
    inset: -120px;
    background:
      radial-gradient(circle at 78% 12%, ${theme.accent2} 0 150px, transparent 152px),
      radial-gradient(circle at 10% 84%, ${theme.accent} 0 190px, transparent 192px),
      linear-gradient(135deg, rgba(0,0,0,0.28), transparent 55%);
    opacity: 0.95;
  }
  .poster {
    position: relative;
    z-index: 1;
    height: 100%;
    border: 7px solid ${theme.ink};
    background:
      radial-gradient(circle at 86% 8%, ${theme.accent2} 0 132px, transparent 134px),
      radial-gradient(circle at 10% 78%, ${theme.accent} 0 160px, transparent 162px),
      linear-gradient(180deg, ${theme.panel} 0%, #07090c 100%);
    box-shadow: 16px 16px 0 rgba(0,0,0,0.45);
    padding: 52px 42px;
    color: white;
  }
  .chips {
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 68px;
    padding: 0 26px;
    background: ${theme.accent};
    border: 4px solid ${theme.ink};
    color: ${theme.chipText};
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    box-shadow: 7px 7px 0 ${theme.ink};
  }
  .chip.alt {
    background: ${theme.accent2};
  }
  .title {
    margin-top: 70px;
    font-size: ${titleLines.join("").length > 14 ? 106 : 124}px;
    line-height: 0.98;
    font-weight: 900;
    letter-spacing: 0;
  }
  .title .line {
    display: block;
    text-shadow: 5px 5px 0 rgba(0,0,0,0.18);
  }
  .title .line:first-child {
    color: ${theme.accent};
  }
  .title .line:nth-child(2) {
    color: white;
  }
  .subtitle {
    margin-top: 44px;
    color: rgba(255,255,255,0.88);
    font-size: 50px;
    line-height: 1.18;
    font-weight: 800;
  }
  .visual {
    position: absolute;
    left: 48px;
    right: 48px;
    bottom: 430px;
    height: 440px;
    background: #f6f2e8;
    border: 7px solid ${theme.ink};
    color: ${theme.ink};
    overflow: hidden;
    box-shadow: 12px 12px 0 rgba(0,0,0,0.38);
  }
  .visual::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(0,0,0,0.07) 1px, transparent 1px),
      linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px);
    background-size: 38px 38px;
    opacity: 0.7;
  }
  .device {
    position: absolute;
    left: 42px;
    top: 52px;
    width: 520px;
    height: 310px;
    border: 6px solid ${theme.ink};
    background: white;
    box-shadow: 16px 16px 0 ${theme.accent};
  }
  .device-bar {
    height: 48px;
    border-bottom: 5px solid ${theme.ink};
    display: flex;
    gap: 12px;
    align-items: center;
    padding-left: 20px;
  }
  .dot {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: ${theme.accent};
  }
  .screen-line {
    height: 20px;
    margin: 26px 28px 0;
    background: ${theme.ink};
  }
  .screen-line.short { width: 58%; }
  .screen-line.mid { width: 78%; background: ${theme.accent2}; }
  .mock-word {
    position: absolute;
    right: 36px;
    top: 72px;
    width: 280px;
    color: ${theme.ink};
    font-size: 55px;
    line-height: 1.04;
    font-weight: 900;
    word-break: break-word;
  }
  .insights {
    position: absolute;
    left: 48px;
    right: 48px;
    bottom: 88px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .insight {
    min-height: 78px;
    padding: 18px 24px;
    background: rgba(255,255,255,0.08);
    color: white;
    border-left: 16px solid ${theme.accent};
    font-size: 40px;
    line-height: 1.1;
    font-weight: 800;
  }
  .verdict {
    position: absolute;
    left: 54px;
    right: 54px;
    bottom: 330px;
    transform: rotate(-1.2deg);
    min-height: 142px;
    padding: 32px 36px;
    background: ${theme.accent};
    border: 6px solid ${theme.ink};
    box-shadow: 10px 10px 0 ${theme.ink};
    color: ${theme.chipText};
    font-size: ${verdict.length > 8 ? 62 : 74}px;
    line-height: 1.05;
    font-weight: 900;
  }
</style>
</head>
<body>
  <main class="cover">
    <section class="poster">
      <div class="chips">
        <div class="chip">${escapeHtml(chip)}</div>
        <div class="chip alt">快速判断</div>
      </div>
      <h1 class="title">${titleLines.map((line) => `<span class="line">${escapeHtml(line)}</span>`).join("")}</h1>
      <div class="subtitle">${subtitleLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
      <div class="visual">
        <div class="device">
          <div class="device-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          <div class="screen-line mid"></div>
          <div class="screen-line"></div>
          <div class="screen-line short"></div>
        </div>
        <div class="mock-word">${escapeHtml(monoWord)}</div>
      </div>
      <div class="verdict">${escapeHtml(verdict)}</div>
      <div class="insights">
        ${insightLines.map((line) => `<div class="insight">${escapeHtml(line)}</div>`).join("")}
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function captureHtml(htmlPath: string, outputPath: string): Promise<void> {
  const chrome = process.env.TOOLREEL_COVER_CHROME_EXECUTABLE?.trim() || MACOS_CHROME_EXECUTABLE;
  const profileDir = await mkdtemp(join(tmpdir(), "toolreel-cover-profile-"));
  try {
    await new Promise<void>((resolvePromise, reject) => {
      let settled = false;
      const child = spawn(chrome, [
        "--headless=new",
        ...commonHeadlessChromeFlags(),
        "--hide-scrollbars",
        `--user-data-dir=${profileDir}`,
        `--window-size=${VIDEO_WIDTH},${VIDEO_HEIGHT}`,
        `--screenshot=${resolve(outputPath)}`,
        pathToFileURL(resolve(htmlPath)).toString(),
      ], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        if (error) {
          reject(error);
          return;
        }
        resolvePromise();
      };
      const timeout = setTimeout(async () => {
        child.kill("SIGKILL");
        if (await screenshotExists(outputPath)) {
          finish();
          return;
        }
        finish(new Error("Cover browser render timed out."));
      }, 30000);
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        finish(error);
      });
      child.on("close", async (code) => {
        if (settled) {
          return;
        }
        if (code === 0) {
          finish();
          return;
        }
        if (await screenshotExists(outputPath)) {
          finish();
          return;
        }
        finish(new Error(`Cover browser render failed with code ${code}: ${stderr.slice(0, 500)}`));
      });
    });
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function screenshotExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.size > 10_000;
  } catch {
    return false;
  }
}

async function generateFallbackCover(script: ScriptData, outputPath: string): Promise<void> {
  const title = coverTitle(script);
  const subtitle = coverSubtitle(script);
  const verdict = coverVerdict(script);
  const filter = [
    `color=c=0xf6f2e8:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1:r=1`,
    "format=yuv420p",
    "drawbox=x=70:y=90:w=940:h=1740:color=0x111417@0.08:t=fill",
    "drawbox=x=96:y=126:w=280:h=74:color=0xffdf3d@1:t=fill",
    "drawbox=x=96:y=850:w=888:h=410:color=0x111417@0.95:t=fill",
    "drawbox=x=96:y=1468:w=888:h=136:color=0xffdf3d@1:t=fill",
    drawAt(coverChip(script), 126, 150, 38, "black"),
    ...drawHeadlineLines(title, 96, 318, title.length > 12 ? 94 : 112, 8),
    ...drawCaptionLines(subtitle, 108, 612, subtitle.length > 16 ? 48 : 56, 13, 2, "0x343a40"),
    drawAt(cleanCoverText(script.toolName, 20), 152, 998, script.toolName.length > 12 ? 64 : 84, "0x7df2c4"),
    drawAt(verdict, 132, 1514, verdict.length > 12 ? 58 : 68, "black"),
  ].join(",");

  await runFfmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", outputPath]);
}

function drawAt(text: string, x: number, y: number, size: number, color = "white"): string {
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}`;
}

function drawHeadlineLines(text: string, x: number, y: number, size: number, charsPerLine: number): string[] {
  return displayLines(cleanCoverText(text), charsPerLine, 2).flatMap((line, index) => {
    const lineY = y + index * Math.round(size * 1.08);
    return [
      drawAt(line, x + 5, lineY + 6, size, "black@0.45"),
      drawAt(line, x, lineY, size, index === 0 ? "0x111417" : "0x111417"),
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

function coverInsights(script: ScriptData): string[] {
  if (script.videoType === "comparison") {
    return ["看定位差异", "看适合场景"];
  }
  if (script.videoType === "tutorial") {
    return ["先找入口", "再试核心功能"];
  }
  if (script.videoType === "top_list") {
    return ["先看筛选标准", "再看真实场景"];
  }
  if (script.videoType === "update_news") {
    return ["看更新重点", "看影响场景"];
  }
  if (script.videoType === "website_demo") {
    return ["看官网定位", "看核心功能"];
  }
  return ["先看它干啥", "再看值不值"];
}

function coverChip(script: ScriptData): string {
  if (script.videoType === "comparison") {
    return "AI工具对比";
  }
  if (script.videoType === "tutorial") {
    return "快速上手";
  }
  if (script.videoType === "top_list") {
    return "工具清单";
  }
  if (script.videoType === "update_news") {
    return "更新速看";
  }
  return "AI工具科普";
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
    return "别收藏一堆名字";
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
