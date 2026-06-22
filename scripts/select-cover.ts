import { access, copyFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CoverData } from "../src/types.ts";
import { writeJson } from "../src/utils/file.ts";

async function main(): Promise<void> {
  const outputDir = resolve(process.argv[2] || "");
  const variant = process.argv[3];
  if (!process.argv[2] || (variant !== "poster" && variant !== "ai")) {
    throw new Error("Usage: pnpm cover:select outputs/YYYY-MM-DD-tool poster|ai");
  }

  const coverPath = join(outputDir, "cover.json");
  const cover = JSON.parse(await readFile(coverPath, "utf8")) as CoverData;
  const candidate = cover.candidates.find((item) => item.id === variant && item.available);
  if (!candidate) {
    throw new Error(`Cover variant ${variant} is not available. Generate or place cover-ai-source.png first.`);
  }
  await access(candidate.outputPath);
  await copyFile(candidate.outputPath, join(outputDir, "cover.png"));
  await writeJson(coverPath, {
    ...cover,
    selectedVariant: variant,
    outputPath: join(outputDir, "cover.png"),
  });
  console.log(`Selected ${variant}: ${join(outputDir, "cover.png")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
