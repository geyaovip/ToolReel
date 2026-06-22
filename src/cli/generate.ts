import { runPipeline } from "../pipeline/runPipeline.ts";
import type { ToolInput, VideoType } from "../types.ts";

type CliArgs = {
  name?: string;
  url?: string;
  topic?: string;
  compare?: string;
  type?: VideoType;
  listTypes?: boolean;
};

const VIDEO_TYPES: Array<{ id: VideoType; description: string }> = [
  { id: "product_pick", description: "单个 AI 工具快速科普与使用场景" },
  { id: "tutorial", description: "一个工具的快速上手教程" },
  { id: "comparison", description: "两个或多个工具的场景化对比" },
  { id: "top_list", description: "某个任务场景下的工具清单" },
  { id: "website_demo", description: "以官网和产品页为主的展示视频" },
  { id: "news", description: "AI 新模型、新产品和行业发布资讯" },
  { id: "update_news", description: "兼容旧命令的产品更新速递" },
];

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
    if (rawKey === "topic") parsed.topic = value;
    if (rawKey === "compare") parsed.compare = value;
    if (rawKey === "type") parsed.type = value as VideoType;
    if (rawKey === "list-types") parsed.listTypes = true;
  }
  return parsed;
}

function requireArgs(args: CliArgs): { name: string; url: string; topic?: string; compareTargets?: ToolInput[]; type: VideoType } {
  const type = args.type ?? "product_pick";
  if (!VIDEO_TYPES.some((item) => item.id === type)) {
    throw new Error(`Unsupported video type: ${type}. Run pnpm generate --list-types.`);
  }
  if (type === "top_list") {
    const topic = args.topic || args.name;
    if (!topic || !args.url) {
      throw new Error(
        'Real source content is required. Usage: pnpm generate --topic="AI coding tools" --name="Cursor" --url="https://cursor.com" --type="top_list"',
      );
    }
    return {
      name: args.name ?? topic,
      url: args.url,
      topic,
      type,
    };
  }

  if (!args.name || !args.url) {
    throw new Error(
      'Usage: pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"',
    );
  }

  return {
    name: args.name,
    url: args.url,
    topic: args.topic,
    compareTargets: parseCompareTargets(args.compare),
    type,
  };
}

function parseCompareTargets(value: string | undefined): ToolInput[] | undefined {
  const targets = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf("=");
      if (separator === -1) {
        throw new Error(
          'Use --compare="Tool A=https://example.com,Tool B=https://example.org" for comparison videos.',
        );
      }
      const name = item.slice(0, separator).trim();
      const url = item.slice(separator + 1).trim();
      if (!name || !url) {
        throw new Error(
          'Use --compare="Tool A=https://example.com,Tool B=https://example.org" for comparison videos.',
        );
      }
      return { name, url };
    });

  return targets?.length ? targets : undefined;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.listTypes) {
    console.log("Available video types:");
    for (const item of VIDEO_TYPES) {
      console.log(`${item.id} - ${item.description}`);
    }
    return;
  }
  const args = requireArgs(parsed);
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
  if (result.runManifest) {
    console.log("");
    console.log("运行清单：");
    console.log(`${result.outputDir}/run.json`);
    console.log(`状态：${result.runManifest.status}`);
  }
  if (result.validation) {
    console.log("");
    console.log("输出校验：");
    console.log(result.validation.passed ? "通过" : "未通过");
    console.log(`校验报告：${result.outputDir}/validation.json`);
    console.log(`首帧预览：${result.validation.firstFramePath}`);
  }
  if (result.mvpReadiness) {
    console.log("");
    console.log("MVP readiness：");
    console.log(result.mvpReadiness.ready ? "ready" : "not ready");
    console.log(`${result.outputDir}/mvp-readiness.json`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
