import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateCover } from "../src/cover/generateCover.ts";
import type { AssetData, ScriptData } from "../src/types.ts";
import { writeJson } from "../src/utils/file.ts";

async function main(): Promise<void> {
  const outputDir = resolve(process.argv[2] || "");
  if (!process.argv[2]) {
    throw new Error("Usage: pnpm cover:build outputs/YYYY-MM-DD-tool");
  }
  const [script, assets] = await Promise.all([
    readJson<ScriptData>(join(outputDir, "script.json")),
    readJson<AssetData>(join(outputDir, "assets.json")),
  ]);
  const cover = await generateCover(script, assets, join(outputDir, "cover.png"));
  await writeJson(join(outputDir, "cover.json"), cover);
  console.log(`Cover candidates updated: ${join(outputDir, "cover.json")}`);
  console.log(`Selected variant: ${cover.selectedVariant}`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
