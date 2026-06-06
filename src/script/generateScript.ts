import type { GenerateInput, ResearchResult, ScriptData } from "../types.ts";
import type { ScriptSegment } from "../types.ts";

export async function generateScript(
  input: GenerateInput,
  research: ResearchResult,
): Promise<ScriptData> {
  const highlights = (research.highlights ?? []).slice(0, 4);
  const useCases = (research.useCases ?? []).slice(0, 3);
  const hook = buildHook(input.name, research);
  const coreSellingPoint = research.positioning || research.summary;
  const segments: ScriptSegment[] = [
    {
      sceneType: "HOOK",
      title: input.name,
      narration: hook,
      bullets: compactBullets([shorten(coreSellingPoint, 16), ...research.sellingPoints], 3),
    },
    {
      sceneType: "WEBSITE_DEMO",
      title: "官网与产品展示",
      narration: `先看 ${input.name} 官网第一屏，快速判断它主打的能力和产品气质。`,
      bullets: compactBullets([research.officialUrl, research.sourcePages?.[0]?.title, "真实官网截图"], 3),
    },
  ];

  if (highlights.length >= 2) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: naturalTitle(highlights[0].title, "核心亮点"),
      narration: `${input.name} 最值得先看的，是 ${toChineseList(highlights.slice(0, 2).map((item) => item.title))}。`,
      bullets: highlights.slice(0, 3).map((item) => item.title),
    });
  } else if (research.sellingPoints.length) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: "核心亮点",
      narration: `${input.name} 的核心价值可以先看这几点：${toChineseList(research.sellingPoints.slice(0, 3))}。`,
      bullets: research.sellingPoints.slice(0, 3),
    });
  }

  if (useCases.length) {
    segments.push({
      sceneType: "WORKFLOW",
      title: "适合这些场景",
      narration: `它更像是一个能进入实际工作流的工具，尤其适合${toChineseList(useCases.slice(0, 2))}。`,
      bullets: useCases,
    });
  } else if (research.targetUsers.length) {
    segments.push({
      sceneType: "TARGET_USER",
      title: "谁会更需要它",
      narration: `${input.name} 更适合已经有明确工作需求、想快速提升效率的人。`,
      bullets: research.targetUsers.slice(0, 4),
    });
  }

  const secondHighlight = highlights[2] ?? highlights[1];
  if (secondHighlight) {
    segments.push({
      sceneType: "FEATURE",
      title: naturalTitle(secondHighlight.title, "再看一个细节"),
      narration: secondHighlight.detail,
      bullets: compactBullets([secondHighlight.title, secondHighlight.detail], 3),
    });
  }

  segments.push({
    sceneType: "CTA",
    title: "一分钟判断值不值得试",
    narration: `总结一下：先看它是不是解决你的真实场景，再试一个核心功能，就能判断 ${input.name} 值不值得继续用。`,
    bullets: ["看懂定位", "试核心功能", "匹配自己的场景"],
  });

  return {
    toolName: input.name,
    videoType: input.type,
    hook,
    coreSellingPoint,
    segments: segments.slice(0, 7),
  };
}

function buildHook(toolName: string, research: ResearchResult): string {
  const positioning = research.positioning || research.summary;
  const clean = shorten(positioning.replace(new RegExp(`^${escapeRegex(toolName)}\\s*`, "i"), ""), 42);
  if (clean.includes("AI") || clean.includes("agent") || clean.includes("智能")) {
    return `${toolName} 不是简单换个界面，它真正值得看的是：${clean}`;
  }
  return `今天快速看 ${toolName}：${clean}`;
}

function naturalTitle(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const clean = value.replace(/[。.!！?？]$/, "");
  return shorten(clean, 14);
}

function compactBullets(values: Array<string | undefined>, limit: number): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => shorten(value, 18))
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, limit);
}

function toChineseList(values: string[]): string {
  const clean = values.map((value) => value.replace(/[。.!！?？]$/, ""));
  if (clean.length <= 1) {
    return clean[0] ?? "核心功能";
  }
  if (clean.length === 2) {
    return `${clean[0]}，以及${clean[1]}`;
  }
  return `${clean.slice(0, -1).join("、")}，以及${clean.at(-1)}`;
}

function shorten(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxChars ? normalized : `${normalized.slice(0, maxChars - 1)}…`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
