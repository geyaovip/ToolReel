import { dirname } from "node:path";
import { AUDIO_SAMPLE_RATE, FONT_FILE, FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, Caption, PlannedScene, ScriptData } from "../../types.ts";
import { ensureDir } from "../../utils/file.ts";
import { runFfmpeg } from "../../utils/ffmpeg.ts";
import { chunkText, displayLines, escapeDrawText } from "../../utils/text.ts";

type RenderSceneVideoArgs = {
  scene: PlannedScene;
  script: ScriptData;
  assets: AssetData;
  captions: Caption[];
  outputPath: string;
  theme: "remotion" | "hyperframes";
};

function drawText({
  text,
  x,
  y,
  size,
  color,
  box = false,
  enable,
}: {
  text: string;
  x: string;
  y: string;
  size: number;
  color: string;
  box?: boolean;
  enable?: string;
}): string {
  const boxConfig = box ? ":box=1:boxcolor=black@0.34:boxborderw=22" : "";
  const enableConfig = enable ? `:enable='${enable}'` : "";
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}${boxConfig}${enableConfig}`;
}

function filterForScene(
  scene: PlannedScene,
  script: ScriptData,
  assets: AssetData,
  captions: Caption[],
  theme: string,
): string {
  const bg = theme === "hyperframes" ? "0x101820" : "0x09111f";
  const accent = theme === "hyperframes" ? "0x00d4ff" : "0x8df5c5";
  const focus = focusLabel(scene);
  const captionLines = timedCaptionLines(captions.length ? captions : fallbackCaptions(scene));
  const hasWebsiteScreenshot = hasUsableAsset(assets.websiteScreenshot);
  const bulletLines = scene.bullets
    .filter((bullet) => hasWebsiteScreenshot || !bullet.includes("真实官网截图"))
    .map((bullet) => displayLines(bullet, 18, 2))
    .filter((lines) => lines.length)
    .slice(0, 3);
  const detailText =
    scene.type === "WEBSITE_DEMO"
      ? assets.homepage?.title || script.coreSellingPoint
      : script.coreSellingPoint;
  const filters = [
    `color=c=${bg}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${scene.duration}:r=${FPS}`,
    "format=yuv420p",
    `drawbox=x=70:y=90:w=940:h=8:color=${accent}@0.95:t=fill`,
    `drawbox=x=650:y=106:w=356:h=58:color=white@0.10:t=fill`,
    drawText({
      text: focus,
      x: "676",
      y: "121",
      size: 25,
      color: "white@0.82",
    }),
    `drawbox=x=86:y=250:w=908:h=610:color=white@0.08:t=fill`,
    `drawbox=x=118:y=310:w=844:h=470:color=black@0.32:t=fill`,
    drawText({
      text: script.toolName,
      x: "118",
      y: "330",
      size: 76,
      color: "white",
    }),
    drawText({
      text: detailText,
      x: "118",
      y: "430",
      size: 38,
      color: "white@0.78",
    }),
  ];

  bulletLines.forEach((lines, index) => {
    const top = 920 + index * 130;
    filters.push(`drawbox=x=128:y=${top}:w=824:h=102:color=white@0.10:t=fill`);
    lines.forEach((line, lineIndex) => {
      filters.push(
        drawText({
          text: `${lineIndex === 0 ? "- " : "  "}${line}`,
          x: "156",
          y: String(top + 18 + lineIndex * 40),
          size: 34,
          color: "white",
        }),
      );
    });
  });

  captionLines.forEach((captionLine) => {
    filters.push(
      drawText({
        text: captionLine.text,
        x: "(w-text_w)/2",
        y: String(1540 + captionLine.lineIndex * 74),
        size: 58,
        color: "white",
        box: true,
        enable: `between(t\\,${captionLine.start}\\,${captionLine.end})`,
      }),
    );
  });

  return filters.join(",");
}

function hasUsableAsset(path: string | undefined): boolean {
  return Boolean(path && path !== "unknown" && !path.startsWith("mock://"));
}

export async function renderSceneVideo(args: RenderSceneVideoArgs): Promise<void> {
  const { scene, script, assets, outputPath, theme } = args;
  await ensureDir(dirname(outputPath));
  if (isWebScene(scene) && websiteDemoScreenshot(assets)) {
    await renderWebsiteScreenshotScene(args);
    return;
  }

  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    filterForScene(scene, script, assets, args.captions, theme),
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=${AUDIO_SAMPLE_RATE}`,
    "-t",
    String(scene.duration),
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);
}

async function renderWebsiteScreenshotScene(args: RenderSceneVideoArgs): Promise<void> {
  const { scene, assets, outputPath, script } = args;
  const profile = websiteDemoProfile(scene);
  const focus = profile.focus;
  const captionLines = timedCaptionLines(args.captions.length ? args.captions : fallbackCaptions(scene));
  const titleLines = displayLines(assets.homepage?.title || script.toolName, 18, 2);
  const scrollDistance = 520;
  const filters = [
    `scale=w=-1:h=${VIDEO_HEIGHT + scrollDistance}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(iw-ow)/2:min(ih-oh\\,max(0\\,(t-0.4)*76))`,
    "format=yuv420p",
    "drawbox=x=0:y=0:w=1080:h=270:color=0x101820@0.94:t=fill",
    "drawbox=x=0:y=1468:w=1080:h=452:color=0x101820@0.86:t=fill",
    `drawbox=x=${profile.boxes[0].x}:y=${profile.boxes[0].y}:w=${profile.boxes[0].w}:h=${profile.boxes[0].h}:color=0x00d4ff@0.30:t=8:enable='between(t,0.9,2.8)'`,
    `drawbox=x=${profile.boxes[1].x}:y=${profile.boxes[1].y}:w=${profile.boxes[1].w}:h=${profile.boxes[1].h}:color=0x8df5c5@0.28:t=8:enable='between(t,2.8,5.4)'`,
    `drawbox=x=${profile.boxes[2].x}:y=${profile.boxes[2].y}:w=${profile.boxes[2].w}:h=${profile.boxes[2].h}:color=white@0.22:t=6:enable='between(t,5.0,8.0)'`,
    "drawbox=x=86:y=292:w=908:h=538:color=black@0.08:t=fill:enable='between(t,0.9,2.8)'",
    "drawbox=x=104:y=716:w=872:h=420:color=black@0.06:t=fill:enable='between(t,2.8,5.4)'",
    `drawbox=x=70:y=90:w=940:h=8:color=0x00d4ff@0.95:t=fill`,
    "drawbox=x=650:y=106:w=356:h=58:color=white@0.10:t=fill",
    drawText({
      text: focus,
      x: "676",
      y: "121",
      size: 25,
      color: "white@0.82",
    }),
    drawText({
      text: profile.kicker,
      x: "86",
      y: "122",
      size: 30,
      color: "white@0.72",
    }),
    drawText({
      text: script.toolName,
      x: "86",
      y: "162",
      size: 48,
      color: "white",
    }),
  ];

  titleLines.forEach((line, index) => {
    filters.push(
      drawText({
        text: line,
        x: "86",
        y: String(218 + index * 40),
        size: 32,
        color: "white@0.78",
      }),
    );
  });

  captionLines.forEach((captionLine) => {
    filters.push(
      drawText({
        text: captionLine.text,
        x: "(w-text_w)/2",
        y: String(1540 + captionLine.lineIndex * 74),
        size: 58,
        color: "white",
        box: true,
        enable: `between(t\\,${captionLine.start}\\,${captionLine.end})`,
      }),
    );
  });

  await runFfmpeg([
    "-loop",
    "1",
    "-i",
    websiteDemoScreenshot(assets) ?? assets.websiteScreenshot,
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=${AUDIO_SAMPLE_RATE}`,
    "-vf",
    filters.join(","),
    "-t",
    String(scene.duration),
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);
}

function websiteDemoScreenshot(assets: AssetData): string | undefined {
  const selected = assets.selectedAssets?.websiteDemoPage?.path;
  if (hasUsableAsset(selected)) {
    return selected;
  }
  return hasUsableAsset(assets.websiteScreenshot) ? assets.websiteScreenshot : undefined;
}

function isWebScene(scene: PlannedScene): boolean {
  return ["WEBSITE_DEMO", "LANDING_PAGE_DEMO", "PRODUCT_PAGE_SCROLL"].includes(scene.type);
}

function fallbackCaptions(scene: PlannedScene): Caption[] {
  return [{ start: 0, end: scene.duration, text: scene.narration, sceneId: scene.id, sceneIndex: scene.index }];
}

function focusLabel(scene: PlannedScene): string {
  const focus = scene.visualFocus?.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  if (focus && focus.length <= 16) {
    return focus;
  }
  if (scene.type === "WEBSITE_DEMO") {
    return "官网主打信息";
  }
  if (scene.type === "WORKFLOW") {
    return "真实使用场景";
  }
  if (scene.type === "CTA") {
    return "记住这个工具";
  }
  return "核心信息";
}

function websiteDemoProfile(scene: PlannedScene): {
  kicker: string;
  focus: string;
  boxes: Array<{ x: number; y: number; w: number; h: number }>;
} {
  const kind = scene.assetSelection?.pageKind;
  if (kind === "demo") {
    return {
      kicker: "演示入口",
      focus: "看产品如何展示",
      boxes: [
        { x: 94, y: 300, w: 892, h: 500 },
        { x: 150, y: 700, w: 780, h: 360 },
        { x: 160, y: 1060, w: 760, h: 300 },
      ],
    };
  }
  if (kind === "docs") {
    return {
      kicker: "文档证据",
      focus: "看功能如何落地",
      boxes: [
        { x: 86, y: 286, w: 908, h: 380 },
        { x: 110, y: 650, w: 860, h: 420 },
        { x: 130, y: 1030, w: 820, h: 330 },
      ],
    };
  }
  if (kind === "features") {
    return {
      kicker: "功能页面",
      focus: "看核心能力",
      boxes: [
        { x: 86, y: 292, w: 908, h: 538 },
        { x: 104, y: 716, w: 872, h: 420 },
        { x: 128, y: 1100, w: 824, h: 260 },
      ],
    };
  }
  if (kind === "enterprise") {
    return {
      kicker: "团队场景",
      focus: "看安全和协作",
      boxes: [
        { x: 86, y: 300, w: 908, h: 460 },
        { x: 116, y: 740, w: 848, h: 360 },
        { x: 128, y: 1090, w: 824, h: 280 },
      ],
    };
  }
  return {
    kicker: "官网入口",
    focus: focusLabel(scene),
    boxes: [
      { x: 86, y: 292, w: 908, h: 538 },
      { x: 104, y: 716, w: 872, h: 420 },
      { x: 128, y: 1100, w: 824, h: 260 },
    ],
  };
}

function timedCaptionLines(captions: Caption[]): Array<{ text: string; start: number; end: number; lineIndex: number }> {
  return captions.flatMap((caption) =>
    chunkText(caption.text, 12)
      .slice(0, 2)
      .map((line, lineIndex) => ({
        text: line,
        start: caption.start,
        end: caption.end,
        lineIndex,
      })),
  );
}
