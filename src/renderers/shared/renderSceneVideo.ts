import { dirname } from "node:path";
import { AUDIO_SAMPLE_RATE, FONT_FILE, FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, PlannedScene, ScriptData } from "../../types.ts";
import { ensureDir } from "../../utils/file.ts";
import { runFfmpeg } from "../../utils/ffmpeg.ts";
import { chunkText, displayLines, escapeDrawText } from "../../utils/text.ts";

type RenderSceneVideoArgs = {
  scene: PlannedScene;
  script: ScriptData;
  assets: AssetData;
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
}: {
  text: string;
  x: string;
  y: string;
  size: number;
  color: string;
  box?: boolean;
}): string {
  const boxConfig = box ? ":box=1:boxcolor=black@0.34:boxborderw=22" : "";
  return `drawtext=fontfile='${FONT_FILE}':text='${escapeDrawText(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}${boxConfig}`;
}

function filterForScene(scene: PlannedScene, script: ScriptData, assets: AssetData, theme: string): string {
  const bg = theme === "hyperframes" ? "0x101820" : "0x09111f";
  const accent = theme === "hyperframes" ? "0x00d4ff" : "0x8df5c5";
  const captionLines = chunkText(scene.narration, 12);
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

  captionLines.forEach((line, index) => {
    filters.push(
      drawText({
        text: line,
        x: "(w-text_w)/2",
        y: String(1540 + index * 74),
        size: 58,
        color: "white",
        box: true,
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
  if (scene.type === "WEBSITE_DEMO" && assets.websiteScreenshot && assets.websiteScreenshot !== "unknown") {
    await renderWebsiteScreenshotScene(args);
    return;
  }

  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    filterForScene(scene, script, assets, theme),
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
  const { scene, assets, outputPath } = args;
  const captionLines = chunkText(scene.narration, 12);
  const scrollDistance = 380;
  const filters = [
    `scale=w=-1:h=${VIDEO_HEIGHT + scrollDistance}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(iw-ow)/2:min(ih-oh\\,t*70)`,
    "format=yuv420p",
    "drawbox=x=0:y=0:w=1080:h=230:color=0x101820@0.82:t=fill",
    "drawbox=x=0:y=1490:w=1080:h=430:color=0x101820@0.80:t=fill",
    "drawbox=x=108:y=392:w=864:h=420:color=0x00d4ff@0.42:t=8:enable='between(t,1.1,3.8)'",
    "drawbox=x=116:y=400:w=848:h=404:color=black@0.10:t=fill:enable='between(t,1.1,3.8)'",
    `drawbox=x=70:y=90:w=940:h=8:color=0x00d4ff@0.95:t=fill`,
  ];

  captionLines.forEach((line, index) => {
    filters.push(
      drawText({
        text: line,
        x: "(w-text_w)/2",
        y: String(1540 + index * 74),
        size: 58,
        color: "white",
        box: true,
      }),
    );
  });

  await runFfmpeg([
    "-loop",
    "1",
    "-i",
    assets.websiteScreenshot,
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
