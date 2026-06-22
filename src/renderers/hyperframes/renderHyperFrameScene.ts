import { existsSync } from "node:fs";
import { copyFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { FONT_FILE } from "../../config.ts";
import type { AssetData, Caption, PlannedScene, ScriptData } from "../../types.ts";
import { cleanupStaleBrowserProfiles } from "../../utils/browser.ts";
import { runCommand } from "../../utils/exec.ts";
import { resolveFfmpegPath, resolveFfprobePath } from "../../utils/ffmpeg.ts";
import { ensureDir } from "../../utils/file.ts";
import { sceneFileName } from "../../utils/text.ts";

const require = createRequire(import.meta.url);
const HYPERFRAMES_CLI = resolve("node_modules/.bin/hyperframes");
const GSAP_SOURCE = require.resolve("gsap/dist/gsap.min.js");
const HYPERFRAMES_FONT_FILE = process.env.TOOLREEL_HYPERFRAMES_FONT_FILE?.trim() ||
  (existsSync("/System/Library/Fonts/Supplemental/Arial.ttf")
    ? "/System/Library/Fonts/Supplemental/Arial.ttf"
    : FONT_FILE);
const RENDER_ATTEMPTS = Number(process.env.HYPERFRAMES_RENDER_ATTEMPTS || 3);
const RENDER_TIMEOUT_MS = Number(process.env.HYPERFRAMES_RENDER_TIMEOUT_MS || 12 * 60 * 1000);

export async function renderHyperFrameScene(
  scene: PlannedScene,
  script: ScriptData,
  assets: AssetData,
  captions: Caption[],
  scenesDir: string,
): Promise<string> {
  const outputPath = resolve(scenesDir, sceneFileName(scene.index, scene.id));
  const projectDir = resolve(scenesDir, "hyperframes", scene.id);
  const screenshot = realScreenshotForScene(scene, assets);
  if (!screenshot) {
    throw new Error(`HyperFrames scene ${scene.id} requires a real local website screenshot.`);
  }

  await rm(projectDir, { recursive: true, force: true });
  await ensureDir(projectDir);
  await Promise.all([
    copyFile(resolve(screenshot), join(projectDir, "website.png")),
    copyFile(GSAP_SOURCE, join(projectDir, "gsap.min.js")),
    copyFile(HYPERFRAMES_FONT_FILE, join(projectDir, "toolreel-font.ttf")),
    writeFile(join(projectDir, "DESIGN.md"), designDocument(), "utf8"),
    writeFile(
      join(projectDir, "index.html"),
      compositionHtml(scene, script, captionsForScene(scene, captions)),
      "utf8",
    ),
  ]);

  await validateComposition(projectDir);
  await renderWithRetry(projectDir, outputPath, scene.id);
  return outputPath;
}

async function validateComposition(projectDir: string): Promise<void> {
  await runHyperFrames(["lint", projectDir], 90_000);
  await runHyperFrames(["validate", projectDir], 120_000);
  await runHyperFrames(["inspect", "--strict", "--samples=7", "--timeout=15000", projectDir], 120_000);
}

async function renderWithRetry(projectDir: string, outputPath: string, sceneId: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RENDER_ATTEMPTS; attempt += 1) {
    try {
      await cleanupStaleBrowserProfiles();
      await rm(outputPath, { force: true });
      await runHyperFrames([
        "render",
        "--strict",
        "--quality=standard",
        "--fps=30",
        "--workers=1",
        "--browser-timeout=90",
        "--protocol-timeout=300000",
        "--player-ready-timeout=90000",
        "--low-memory-mode",
        `--output=${outputPath}`,
        projectDir,
      ], RENDER_TIMEOUT_MS);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < RENDER_ATTEMPTS) {
        console.warn(`HyperFrames render attempt ${attempt} failed for ${sceneId}; retrying with a clean browser runtime.`);
        await wait(attempt * 1500);
      }
    }
  }
  throw lastError;
}

async function runHyperFrames(args: string[], timeoutMs: number): Promise<void> {
  const [ffmpegPath, ffprobePath] = await Promise.all([resolveFfmpegPath(), resolveFfprobePath()]);
  await runCommand(HYPERFRAMES_CLI, args, {
    timeoutMs,
    env: {
      ...process.env,
      PATH: [dirname(ffmpegPath), dirname(ffprobePath), process.env.PATH].filter(Boolean).join(":"),
      PRODUCER_PAGE_NAVIGATION_TIMEOUT_MS: process.env.PRODUCER_PAGE_NAVIGATION_TIMEOUT_MS || "90000",
      PRODUCER_PUPPETEER_PROTOCOL_TIMEOUT_MS: process.env.PRODUCER_PUPPETEER_PROTOCOL_TIMEOUT_MS || "300000",
      PRODUCER_PLAYER_READY_TIMEOUT_MS: process.env.PRODUCER_PLAYER_READY_TIMEOUT_MS || "90000",
    },
  });
}

function realScreenshotForScene(scene: PlannedScene, assets: AssetData): string | undefined {
  const selected =
    scene.type === "PRODUCT_PAGE_SCROLL"
      ? assets.selectedAssets?.featurePage?.path ?? assets.selectedAssets?.websiteDemoPage?.path
      : assets.selectedAssets?.websiteDemoPage?.path;
  return [selected, assets.productPageScreenshot, assets.productScreenshot, assets.websiteScrollScreenshot, assets.websiteScreenshot]
    .find((path) => Boolean(path && path !== "unknown" && !path.startsWith("http")));
}

function compositionHtml(scene: PlannedScene, script: ScriptData, captions: Caption[]): string {
  const duration = Math.max(1, scene.duration);
  const focus = cleanVisibleText(scene.visualFocus || scene.title || script.coreSellingPoint);
  const supporting = scene.bullets.map((item) => cleanVisibleText(item)).filter(Boolean).slice(0, 2);
  const captionMarkup = captions
    .map((caption, index) => `<div class="caption" id="caption-${index}">${escapeHtml(caption.text)}</div>`)
    .join("");
  const captionTweens = captions
    .map((caption, index) => {
      const start = Math.max(0.1, caption.start);
      const visibleEnd = Math.min(duration, Math.max(start + 0.5, caption.end));
      return `
        tl.fromTo("#caption-${index}", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.22, ease: "power3.out" }, ${start});
        tl.to("#caption-${index}", { opacity: 0, y: -18, duration: 0.18, ease: "power2.in" }, ${Math.max(start + 0.3, visibleEnd - 0.18)});`;
    })
    .join("");
  const panDistance = scene.type === "PRODUCT_PAGE_SCROLL" ? -420 : -180;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #101820; }
    @font-face { font-family: "ToolReel Sans"; src: url("toolreel-font.ttf") format("truetype"); font-weight: 100 900; }
    body { font-family: "ToolReel Sans", sans-serif; color: #f4f8f7; }
    [data-composition-id] { position: relative; width: 100%; height: 100%; overflow: hidden; background: #101820; }
    .page-wrap { position: absolute; inset: 0; overflow: hidden; background: #e9efed; }
    .page { width: 100%; min-height: 2340px; object-fit: cover; object-position: top center; filter: saturate(0.92) contrast(1.03); }
    .shade { position: absolute; inset: 0; background: radial-gradient(circle at 50% 44%, transparent 18%, rgba(16,24,32,0.18) 72%); pointer-events: none; }
    .header { position: absolute; inset: 0 0 auto; min-height: 310px; padding: 76px 76px 44px; display: flex; flex-direction: column; justify-content: flex-end; gap: 18px; background: rgba(16,24,32,0.94); border-bottom: 6px solid #efca4a; }
    .tool { font-family: "ToolReel Sans", sans-serif; font-size: 48px; line-height: 1; font-weight: 900; color: #efca4a; overflow-wrap: anywhere; }
    .focus { max-width: 900px; font-size: 64px; line-height: 1.13; font-weight: 900; color: #f4f8f7; overflow-wrap: anywhere; }
    .points { position: absolute; left: 66px; right: 66px; top: 1240px; display: flex; gap: 18px; align-items: stretch; }
    .point { flex: 1 1 0; min-width: 0; padding: 24px 26px; background: rgba(16,24,32,0.9); border: 2px solid rgba(244,248,247,0.2); font-size: 30px; line-height: 1.25; font-weight: 700; overflow-wrap: anywhere; }
    .captions { position: absolute; left: 64px; right: 64px; bottom: 132px; min-height: 180px; display: flex; align-items: center; justify-content: center; }
    .caption { position: absolute; max-width: 940px; padding: 24px 32px; opacity: 0; background: rgba(9,14,18,0.9); color: #f4f8f7; font-size: 54px; line-height: 1.28; font-weight: 800; text-align: center; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main id="${escapeHtml(scene.id)}" data-composition-id="${escapeHtml(scene.id)}" data-start="0" data-duration="${duration}" data-track-index="0" data-width="1080" data-height="1920">
    <div class="page-wrap" data-layout-ignore><img class="page" src="website.png" crossorigin="anonymous" alt="" /></div>
    <div class="shade" data-layout-ignore></div>
    <header class="header"><div class="tool">${escapeHtml(script.toolName)}</div><div class="focus">${escapeHtml(focus)}</div></header>
    <div class="points">${supporting.map((item) => `<div class="point">${escapeHtml(item)}</div>`).join("")}</div>
    <div class="captions">${captionMarkup}</div>
  </main>
  <script src="gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(".header", { opacity: 0, y: -42 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, 0.15);
    tl.fromTo(".tool", { opacity: 0, x: -38 }, { opacity: 1, x: 0, duration: 0.46, ease: "power3.out" }, 0.28);
    tl.fromTo(".focus", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.52, ease: "back.out(1.15)" }, 0.42);
    tl.fromTo(".points", { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 0.55, ease: "circ.out" }, 0.72);
    tl.fromTo(".page", { y: 0, scale: 1.02 }, { y: ${panDistance}, scale: 1.07, duration: ${duration}, ease: "none" }, 0);
    ${captionTweens}
    window.__timelines[${JSON.stringify(scene.id)}] = tl;
  </script>
</body>
</html>`;
}

function captionsForScene(scene: PlannedScene, captions: Caption[]): Caption[] {
  const sceneStart = captions.find((caption) => caption.sceneId === scene.id)?.start ?? 0;
  return captions
    .filter((caption) => caption.sceneId === scene.id)
    .map((caption) => ({
      ...caption,
      start: Math.max(0, caption.start - sceneStart),
      end: Math.max(0, caption.end - sceneStart),
    }));
}

function designDocument(): string {
  return `# ToolReel HyperFrames Visual Identity\n\n## Style Prompt\n真实网页为主视觉，竖屏科技媒体编辑风格，信息层级清晰，动效克制但持续。\n\n## Colors\n- Canvas: #101820\n- Foreground: #F4F8F7\n- Accent: #EFCA4A\n- Page surface: #E9EFED\n\n## Typography\n- 中文与英文：ToolReel Sans，本地字体文件嵌入 composition。\n\n## Motion\n- 真实网页缓慢滚动和轻微推进。\n- 标题分层进入，字幕按口播时间独立出现。\n\n## What NOT to Do\n- 不显示网址。\n- 不显示内部模板名称。\n- 不生成假产品界面。\n- 不使用省略号截断文字。\n`;
}

function cleanVisibleText(value: string): string {
  const clean = value.replace(/https?:\/\/\S+/gi, "").replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  return clean;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
