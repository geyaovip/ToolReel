import type { CreativeBrief, GenerateInput, ResearchResult, ScriptData } from "../types.ts";
import type { ScriptSegment } from "../types.ts";

export async function generateScript(
  input: GenerateInput,
  research: ResearchResult,
  creative: CreativeBrief,
): Promise<ScriptData> {
  const highlights = insightHighlights(research).slice(0, 4);
  const useCases = insightUseCases(research).slice(0, 3);
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
      narration: `先看 ${input.name} 的官网入口，不急着听宣传词，先抓两个信息：它主打什么，以及它想解决什么场景。`,
      bullets: compactBullets([research.sourcePages?.[0]?.title, "官网首屏", "产品定位"], 3),
    },
  ];

  if (highlights.length >= 2) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: naturalTitle(highlights[0].title, "核心亮点"),
      narration: `讲清楚它是干什么的之后，再看一个核心功能点。${input.name} 这里最值得看的是 ${toChineseList(highlights.slice(0, 2).map((item) => item.title))}。`,
      bullets: highlights.slice(0, 3).map((item) => item.title),
    });
  } else if (research.sellingPoints.length) {
    segments.push({
      sceneType: "SELLING_POINT",
      title: "核心亮点",
      narration: `别把它当成单纯功能列表看。${input.name} 的核心价值，可以先理解成 ${toChineseList(research.sellingPoints.slice(0, 3))}。`,
      bullets: research.sellingPoints.slice(0, 3),
    });
  }

  if (useCases.length) {
    segments.push({
      sceneType: "WORKFLOW",
      title: "放进真实场景看",
      narration: `接下来要看它适合什么场景。工具科普最重要的不是背功能名，而是知道它能放进哪类工作流。它尤其适合 ${toChineseList(useCases.slice(0, 2))}。`,
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
    title: "最后怎么记住它",
    narration: `最后用一句话记住它：先看它解决的场景，再看一个核心功能。如果这个场景正好是你的问题，${input.name} 就值得进一步了解。`,
    bullets: ["记住定位", "对应场景", "再试核心功能"],
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
      coverSubtitle: creative.coverIdeas[0]?.subtitle ?? "一分钟讲清楚",
    },
  };
}

function insightHighlights(research: ResearchResult): Array<{ title: string; detail: string; sourceUrl: string }> {
  const insightHighlights = (research.insights ?? [])
    .filter((item) => ["core_capability", "workflow", "trust"].includes(item.category))
    .map((item) => ({ title: item.title, detail: item.detail, sourceUrl: item.sourceUrl }));
  return insightHighlights.length ? insightHighlights : (research.highlights ?? []);
}

function insightUseCases(research: ResearchResult): string[] {
  const insights = (research.insights ?? [])
    .filter((item) => ["use_case", "workflow", "audience"].includes(item.category))
    .map((item) => item.title);
  return insights.length ? [...new Set(insights)] : (research.useCases ?? []);
}

function buildHook(toolName: string, research: ResearchResult, creative: CreativeBrief): string {
  const selectedAngle = creative.selectedAngle;
  if (!(research.sourcePages?.length || research.evidence?.length)) {
    return `这条不做产品说明书，今天只用基础信息讲清楚 ${toolName} 是干什么的。`;
  }

  const positioning = research.positioning || research.summary;
  const clean =
    fitDisplayText(
      positioning
        .replace(new RegExp(`^${escapeRegex(toolName)}\\s*`, "i"), "")
        .replace(/^是一个?/, ""),
      42,
    ) ?? "值得快速了解的 AI 工具";

  if (selectedAngle.id === "what-it-does") {
    return `这条不做产品说明书，先用一分钟讲清楚 ${toolName} 是干什么的：${clean}`;
  }
  if (selectedAngle.id === "workflow-fit") {
    return `一个工具值不值得知道，关键看它能不能放进真实工作流。${toolName} 这次先看：${clean}`;
  }
  if (selectedAngle.id === "key-difference") {
    return `这类工具最容易讲成一堆卖点。${toolName} 真正要看的是：${clean}`;
  }
  if (selectedAngle.id === "scenario-first") {
    return `别先问 ${toolName} 功能多不多，先看它解决什么场景：${clean}`;
  }
  if (selectedAngle.id === "team-trust") {
    return `个人试用看功能，团队要用就得多看一层。${toolName} 这次我会重点看：${clean}`;
  }
  return `这条不做产品说明书，只快速讲清楚 ${toolName}：${clean}`;
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortTitle(toolName: string, angleTitle: string): string {
  if (angleTitle.includes("干什么")) {
    return `${toolName} 是干啥的`;
  }
  if (angleTitle.includes("工作流")) {
    return `${toolName} 怎么用`;
  }
  if (angleTitle.includes("团队")) {
    return `${toolName} 适合团队吗`;
  }
  if (angleTitle.includes("省时间")) {
    return `${toolName} 省时间吗`;
  }
  return toolName;
}
