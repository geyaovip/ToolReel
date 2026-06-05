import { existsSync } from "node:fs";
import { runCommand } from "./exec.ts";

type FfmpegInstaller = {
  path?: string;
};

export async function resolveFfmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  try {
    const imported = (await import("@ffmpeg-installer/ffmpeg")) as {
      default?: FfmpegInstaller;
      path?: string;
    };
    const packagePath = imported.default?.path ?? imported.path;
    if (packagePath && existsSync(packagePath)) {
      return packagePath;
    }
  } catch {
    // Dependency is optional at runtime until pnpm install has been run.
  }

  throw new Error(
    "FFmpeg is required. Run `pnpm install` so @ffmpeg-installer/ffmpeg is available, or set FFMPEG_PATH.",
  );
}

export async function runFfmpeg(args: string[]): Promise<void> {
  await runCommand(await resolveFfmpegPath(), ["-hide_banner", "-y", ...args]);
}

