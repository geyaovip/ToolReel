import { AUDIO_SAMPLE_RATE, FONT_FILE, FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../../config.ts";
import type { AssetData, PlannedScene, ScriptData } from "../../types.ts";
import { runFfmpeg } from "../../utils/ffmpeg.ts";
import { chunkText, escapeDrawText } from "../../utils/text.ts";

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
  const bulletLines = scene.bullets.slice(0, 3);
  const filters = [
    `color=c=${bg}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${scene.duration}:r=${FPS}`,
    "format=yuv420p",
    `drawbox=x=70:y=90:w=940:h=8:color=${accent}@0.95:t=fill`,
    `drawbox=x=86:y=250:w=908:h=610:color=white@0.08:t=fill`,
    `drawbox=x=118:y=310:w=844:h=470:color=black@0.32:t=fill`,
    drawText({
      text: scene.renderer ?? theme,
      x: "76",
      y: "122",
      size: 34,
      color: "white@0.74",
    }),
    drawText({
      text: scene.title,
      x: "86",
      y: "174",
      size: scene.title.length > 14 ? 56 : 70,
      color: "white",
      box: true,
    }),
    drawText({
      text: script.toolName,
      x: "118",
      y: "330",
      size: 76,
      color: "white",
    }),
    drawText({
      text: scene.type === "WEBSITE_DEMO" ? assets.websiteScreenshot : script.coreSellingPoint,
      x: "118",
      y: "430",
      size: 38,
      color: "white@0.78",
    }),
  ];

  bulletLines.forEach((bullet, index) => {
    filters.push(`drawbox=x=128:y=${930 + index * 112}:w=824:h=74:color=white@0.10:t=fill`);
    filters.push(
      drawText({
        text: `- ${bullet}`,
        x: "156",
        y: String(946 + index * 112),
        size: 38,
        color: "white",
      }),
    );
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

  filters.push(
    drawText({
      text: "MVP MOCK VIDEO - no account logo / no watermark",
      x: "(w-text_w)/2",
      y: "1810",
      size: 28,
      color: "white@0.42",
    }),
  );

  return filters.join(",");
}

export async function renderSceneVideo(args: RenderSceneVideoArgs): Promise<void> {
  const { scene, script, assets, outputPath, theme } = args;
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

