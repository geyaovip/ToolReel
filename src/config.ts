import { existsSync } from "node:fs";

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 30;
export const AUDIO_SAMPLE_RATE = 48000;

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Songti.ttc",
];

export const FONT_FILE =
  FONT_CANDIDATES.find((candidate) => existsSync(candidate)) ?? FONT_CANDIDATES[0];
