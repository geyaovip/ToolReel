import type { CreativeBrief, GenerateInput, ResearchResult, ScriptData } from "../types.ts";
import type { ScriptSegment } from "../types.ts";

export async function generateScript(
  input: GenerateInput,
  research: ResearchResult,
  creative: CreativeBrief,
): Promise<ScriptData> {
  const highlights = (research.highlights ?? []).slice(0, 4);
  const useCases = (research.useCases ?? []).slice(0, 3);
  const hook = buildHook(input.name, research, creative);
  const coreSellingPoint = research.positioning || research.summary;
  const selectedAngle = creative.selectedAngle;
  const segments: ScriptSegment[] = [
    {
      sceneType: "HOOK",
      title: shortTitle(input.name, selectedAngle.title),
      narration: hook,
      bullets: compactBullets([selectedAngle.thesis, ...selectedAngle.proofPoints, coreSellingPoint], 3),
    },
    {
      sceneType: "WEBSITE_DEMO",
      title: "先看官网怎么说",
      narration: `先看 ${input.name} 的官网入口，不急着听宣传词，先抓它的定位和可信证据。`,
      bullets: compactBullets([displayUrl(research.officialUrl), research.sourcePages?.[0]?.title, "官网入口"], 3),
    },
  ];

  if (highlights.length >= 2) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: naturalTitle(highlights[0].title, "核心亮点"),
      narration: `我会先看它有没有一个能落地的核心点。${input.name} 这里最值得看的是${toChineseList(highlights.slice(0, 2).map((item) => item.title))}。`,
      bullets: highlights.slice(0, 3).map((item) => item.title),
    });
  } else if (research.sellingPoints.length) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: "核心亮点",
      narration: `别把它当成单纯功能列表看。${input.name} 的核心价值，先看${toChineseList(research.sellingPoints.slice(0, 3))}。`,
      bullets: research.sellingPoints.slice(0, 3),
    });
  }

  if (useCases.length) {
    segments.push({
      sceneType: "WORKFLOW",
      title: "放进真实场景看",
      narration: `真正决定要不要试它的，不是功能名，而是它能不能放进你的工作流。它尤其适合${toChineseList(useCases.slice(0, 2))}。`,
      bullets: useCases,
    });
  } else if (research.targetUsers.length) {
    segments.push({
      sceneType: "TARGET_USER",
      title: "谁会更需要它",
      narration: `${input.name} 不一定适合所有人。它更适合已经有明确工作需求、想把重复步骤交给工具处理的人。`,
      bullets: research.targetUsers.slice(0, 4),
    });
  }

  const secondHighlight = highlights[2] ?? highlights[1];
  if (secondHighlight) {
    segments.push({
      sceneType: "FEATURE",
      title: naturalTitle(secondHighlight.title, "再看一个细节"),
      narration: `再补一个判断细节：${secondHighlight.detail}`,
      bullets: compactBullets([secondHighlight.title, secondHighlight.detail], 3),
    });
  }

  segments.push({
    sceneType: "CTA",
    title: "怎么判断值不值得试",
    narration: `最后给你一个简单判断法：先找一个自己的真实场景，再试一个核心功能。如果这一步真的省时间，${input.name} 才值得继续用。`,
    bullets: ["找真实场景", "试核心功能", "看是否真的省时间"],
  });

  return {
    toolName: input.name,
    videoType: input.type,
    hook,
    coreSellingPoint,
    segments: segments.slice(0, 7),
    creative: {
      angleId: creative.selectedAngle.id,
      angleTitle: creative.selectedAngle.title,
      coverTitle: creative.coverIdeas[0]?.title ?? `${input.name} 值得试吗`,
      coverSubtitle: creative.coverIdeas[0]?.subtitle ?? "一分钟判断值不值得试",
    },
  };
}

function buildHook(toolName: string, research: ResearchResult, creative: CreativeBrief): string {
  const selectedAngle = creative.selectedAngle;
  if (!(research.sourcePages?.length || research.evidence?.length)) {
    return `这条不做产品说明书，今天只用基础信息快速判断 ${toolName} 值不值得继续了解。`;
  }

  const positioning = research.positioning || research.summary;
  const clean =
    fitDisplayText(
      positioning
        .replace(new RegExp(`^${escapeRegex(toolName)}\\s*`, "i"), "")
        .replace(/^是一个?/, ""),
      42,
    ) ?? "值得快速了解的 AI 工具";

  if (selectedAngle.id === "workflow-shift") {
    return `如果你还只是把 ${toolName} 当成一个功能工具，可能低估它了。它真正值得看的是：${clean}`;
  }
  if (selectedAngle.id === "hidden-difference") {
    return `这类工具最容易看错，因为表面功能都很像。${toolName} 真正要看的，是${clean}`;
  }
  if (selectedAngle.id === "time-saver") {
    return `${toolName} 是不是真的省时间，不看宣传语，先看它能不能做到：${clean}`;
  }
  if (selectedAngle.id === "team-trust") {
    return `个人试用看功能，团队要用就得多看一层。${toolName} 这次我会重点看：${clean}`;
  }
  return `这条不做产品说明书，只快速判断 ${toolName} 值不值得试：${clean}`;
}

function naturalTitle(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const clean = value.replace(/[。.!！?？]$/, "");
  return fitDisplayText(clean, 18) ?? fallback;
}

function compactBullets(values: Array<string | undefined>, limit: number): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => fitDisplayText(value, 32))
    .filter((value): value is string => Boolean(value))
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

function fitDisplayText(value: string, maxChars: number): string | undefined {
  const normalized = value.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxChars ? normalized : undefined;
}

function displayUrl(value: string): string | undefined {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return fitDisplayText(value, 24);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortTitle(toolName: string, angleTitle: string): string {
  if (angleTitle.includes("工作流")) {
    return `${toolName} 的真正看点`;
  }
  if (angleTitle.includes("团队")) {
    return `${toolName} 适合团队吗`;
  }
  if (angleTitle.includes("省时间")) {
    return `${toolName} 省时间吗`;
  }
  return toolName;
}
