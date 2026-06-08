import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetCandidate, QuoteCandidate } from "../types.ts";

export type ManualAssets = {
  logoCandidates?: AssetCandidate[];
  imageCandidates?: AssetCandidate[];
  videoCandidates?: AssetCandidate[];
  socialCandidates?: AssetCandidate[];
  pageCandidates?: AssetCandidate[];
  externalCandidates?: AssetCandidate[];
  quoteCandidates?: QuoteCandidate[];
  localRecordings?: AssetCandidate[];
};

export async function readManualAssets(outputDir: string): Promise<ManualAssets | undefined> {
  const candidates = [
    join(outputDir, "assets.manual.json"),
    process.env.TOOLREEL_MANUAL_ASSETS?.trim(),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      return JSON.parse(await readFile(path, "utf8")) as ManualAssets;
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return undefined;
}

export function mergeManualAssets<T>(autoItems: T[], manualItems: T[] | undefined): T[] {
  return [...autoItems, ...(manualItems ?? [])];
}
