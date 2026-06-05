import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlannedScene } from "../types.ts";
import { runFfmpeg } from "../utils/ffmpeg.ts";

export async function mergeScenes(
  scenes: PlannedScene[],
  _voicePath: string,
  outputPath: string,
): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "toolreel-"));
  const concatPath = join(tempDir, "scenes.txt");
  const concatBody = scenes
    .map((scene) => {
      if (!scene.outputPath) {
        throw new Error(`Scene ${scene.id} has no outputPath.`);
      }
      return `file '${process.cwd()}/${scene.outputPath}'`;
    })
    .join("\n");

  await writeFile(concatPath, `${concatBody}\n`, "utf8");

  await runFfmpeg([
    "-fflags",
    "+genpts",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    "setpts=PTS-STARTPTS",
    "-af",
    "asetpts=PTS-STARTPTS",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-r",
    "30",
    "-g",
    "30",
    "-keyint_min",
    "30",
    "-sc_threshold",
    "0",
    "-force_key_frames",
    "0",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    outputPath,
  ]);

  return outputPath;
}
