import { runPipeline } from "../pipeline/runPipeline.ts";
import type { VideoType } from "../types.ts";

type CliArgs = {
  name?: string;
  url?: string;
  type?: VideoType;
};

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    const value = rawValue.join("=");
    if (rawKey === "name") parsed.name = value;
    if (rawKey === "url") parsed.url = value;
    if (rawKey === "type") parsed.type = value as VideoType;
  }
  return parsed;
}

function requireArgs(args: CliArgs): Required<CliArgs> {
  if (!args.name || !args.url) {
    throw new Error(
      'Usage: pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"',
    );
  }

  return {
    name: args.name,
    url: args.url,
    type: args.type ?? "product_pick",
  };
}

async function main(): Promise<void> {
  const args = requireArgs(parseArgs(process.argv.slice(2)));
  const result = await runPipeline(args);

  console.log(`使用渲染模式：${result.renderMode}`);
  console.log("");
  console.log("Scenes:");
  for (const scene of result.scenes) {
    console.log(`${scene.index}. ${scene.type} - ${scene.renderer}`);
  }
  console.log("");
  console.log("输出目录：");
  console.log(`${result.outputDir}/`);
  console.log("");
  console.log("最终视频：");
  console.log(result.finalVideo);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

