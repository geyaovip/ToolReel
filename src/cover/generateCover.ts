import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "puppeteer-core";
import type { AssetData, CoverData, ScriptData } from "../types.ts";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../config.ts";
import { cleanupStaleBrowserProfiles, commonHeadlessChromeFlags, MACOS_CHROME_EXECUTABLE } from "../utils/browser.ts";
import { ensureDir } from "../utils/file.ts";

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
  await generateHtmlCover(script, outputPath);
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
  const titleLines = [coverTitle(script)];
  const subtitleLines = [coverSubtitle(script)];
  const insightLines = coverInsights(script);
  const chip = coverChip(script);
  const verdict = coverVerdict(script);
  const visualWord = coverVisualWord(script.toolName);
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
    min-width: 0;
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
    max-width: 48%;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .chip.alt {
    background: ${theme.accent2};
  }
  .headline-zone {
    position: absolute;
    left: 42px;
    right: 42px;
    top: 210px;
    height: 570px;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }
  .title {
    margin: 0;
    max-height: 270px;
    overflow: hidden;
    font-size: ${titleLines.join("").length > 14 ? 106 : 124}px;
    line-height: 0.98;
    font-weight: 900;
    letter-spacing: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .title .line {
    display: block;
    text-shadow: 5px 5px 0 rgba(0,0,0,0.18);
    overflow-wrap: anywhere;
  }
  .title .line:first-child {
    color: ${theme.accent};
  }
  .title .line:nth-child(2) {
    color: white;
  }
  .subtitle {
    margin: 0;
    max-height: 150px;
    overflow: hidden;
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
  .product-word {
    position: absolute;
    right: 36px;
    top: 72px;
    width: 280px;
    color: ${theme.ink};
    font-size: 55px;
    line-height: 1.04;
    font-weight: 900;
    overflow-wrap: anywhere;
    max-height: 230px;
    overflow: hidden;
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
    overflow-wrap: anywhere;
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
    max-height: 170px;
    overflow: hidden;
    overflow-wrap: anywhere;
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
      <div class="headline-zone">
        <h1 class="title">${titleLines.map((line) => `<span class="line">${escapeHtml(line)}</span>`).join("")}</h1>
        <div class="subtitle">${subtitleLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
      </div>
      <div class="visual">
        <div class="device">
          <div class="device-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          <div class="screen-line mid"></div>
          <div class="screen-line"></div>
          <div class="screen-line short"></div>
        </div>
        <div class="product-word">${escapeHtml(monoWord)}</div>
      </div>
      <div class="verdict">${escapeHtml(verdict)}</div>
      <div class="insights">
        ${insightLines.map((line) => `<div class="insight">${escapeHtml(line)}</div>`).join("")}
      </div>
    </section>
  </main>
  <script>
    const fitText = (element, minSize, maxSize) => {
      element.style.fontSize = maxSize + "px";
      let size = maxSize;
      while (size > minSize && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 16)) {
        size -= 2;
        element.style.fontSize = size + "px";
      }
      return element.scrollWidth <= element.clientWidth + 2 && element.scrollHeight <= element.clientHeight + 16;
    };
    const fits = [
      fitText(document.querySelector(".title"), 48, ${titleLines.join("").length > 14 ? 106 : 124}),
      fitText(document.querySelector(".subtitle"), 30, 50),
      fitText(document.querySelector(".product-word"), 28, 55),
      fitText(document.querySelector(".verdict"), 40, ${verdict.length > 8 ? 62 : 74}),
      ...Array.from(document.querySelectorAll(".chip")).map((element) => fitText(element, 22, 34)),
      ...Array.from(document.querySelectorAll(".insight")).map((element) => fitText(element, 28, 40)),
    ];
    const poster = document.querySelector(".poster").getBoundingClientRect();
    const audited = Array.from(document.querySelectorAll(".chip, .title, .subtitle, .visual, .product-word, .verdict, .insight"));
    const insidePoster = audited.every((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= poster.left - 2 && rect.right <= poster.right + 2 && rect.top >= poster.top - 2 && rect.bottom <= poster.bottom + 2;
    });
    document.body.dataset.coverLayout = fits.every(Boolean) && insidePoster ? "ok" : "overflow";
  </script>
</body>
</html>`;
}

async function captureHtml(htmlPath: string, outputPath: string): Promise<void> {
  const chrome = process.env.TOOLREEL_COVER_CHROME_EXECUTABLE?.trim() || MACOS_CHROME_EXECUTABLE;
  const browser = await launch({
    executablePath: chrome,
    headless: true,
    args: [...commonHeadlessChromeFlags(), "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(htmlPath)).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => document.body.dataset.coverLayout, { timeout: 10000 });
    const layout = await page.evaluate(() => document.body.dataset.coverLayout);
    if (layout !== "ok") {
      throw new Error("Cover layout audit detected text overflow or content outside the safe frame.");
    }
    await page.screenshot({ path: resolve(outputPath), type: "png" });
  } finally {
    await browser.close();
  }
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

function cleanCoverText(text: string, _maxChars = 24): string {
  return text.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
}

function coverVisualWord(toolName: string): string {
  const clean = toolName.replace(/\s+/g, " ").trim();
  if (visualLength(clean) <= 14) {
    return clean;
  }
  const capitals = clean.match(/[A-Z]/g)?.join("") ?? "";
  if (capitals.length >= 2 && capitals.length <= 8) {
    return capitals;
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").slice(0, 8).toUpperCase();
  }
  return clean.slice(0, 12);
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
