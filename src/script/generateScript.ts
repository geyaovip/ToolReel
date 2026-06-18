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
  const base = {
    toolName: input.name,
    videoType: input.type,
    hook,
    coreSellingPoint,
    creative: {
      angleId: creative.selectedAngle.id,
      angleTitle: creative.selectedAngle.title,
      coverTitle: creative.coverIdeas[0]?.title ?? `${input.name} 值得试吗`,
      coverSubtitle: creative.coverIdeas[0]?.subtitle ?? "一分钟讲清楚",
    },
  };

  if (input.type === "tutorial") {
    return { ...base, segments: tutorialSegments(input, research, highlights, useCases, hook).slice(0, 7) };
  }
  if (input.type === "comparison") {
    return { ...base, segments: comparisonSegments(input, research, highlights, useCases, hook).slice(0, 7) };
  }
  if (input.type === "top_list") {
    return { ...base, segments: topListSegments(input, research, useCases, hook).slice(0, 7) };
  }
  if (input.type === "website_demo") {
    return { ...base, segments: websiteDemoSegments(input, research, highlights, hook).slice(0, 7) };
  }
  if (input.type === "update_news") {
    return { ...base, segments: updateNewsSegments(input, research, highlights, useCases, hook).slice(0, 7) };
  }

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
    ...base,
    segments: segments.slice(0, 7),
  };
}

function tutorialSegments(
  input: GenerateInput,
  research: ResearchResult,
  highlights: Array<{ title: string; detail: string; sourceUrl: string }>,
  useCases: string[],
  hook: string,
): ScriptSegment[] {
  const firstStep = useCases[0] ?? "先找到最常用的入口";
  const secondStep = highlights[0]?.title ?? research.sellingPoints[0] ?? "再试一个核心功能";
  const thirdStep = highlights[1]?.title ?? useCases[1] ?? "最后判断是否适合你的流程";
  return [
    {
      sceneType: "HOOK",
      title: `${input.name} 快速上手`,
      narration: `${hook} 这条按教程讲，不背功能表，只看第一次使用应该先点哪里、试什么、怎么判断有没有用。`,
      bullets: compactBullets([firstStep, secondStep, thirdStep], 3),
    },
    {
      sceneType: "LANDING_PAGE_DEMO",
      title: "第一步看入口",
      narration: `第一步先看入口。打开 ${input.name}，先别急着研究全部页面，先确认它把核心能力放在哪里。`,
      bullets: ["看入口", "找核心能力", "别迷路"],
    },
    {
      sceneType: "PRODUCT_PAGE_SCROLL",
      title: "第二步试核心功能",
      narration: `第二步只试一个核心功能：${secondStep}。一个工具是不是适合你，通常试这一处就能有初步感觉。`,
      bullets: compactBullets([secondStep, highlights[0]?.detail], 3),
    },
    {
      sceneType: "WORKFLOW",
      title: "第三步放进流程",
      narration: `第三步把它放进真实任务里。比如 ${firstStep}，不要为了试工具而试工具，要看它能不能少掉一个重复步骤。`,
      bullets: compactBullets([firstStep, useCases[1], "少掉重复步骤"], 3),
    },
    {
      sceneType: "CTA",
      title: "怎么判断值不值",
      narration: `最后判断很简单：如果它能稳定解决你的一个高频步骤，再继续深用；如果只是看起来很酷，可以先放一放。`,
      bullets: ["解决高频步骤", "再继续深用", "不硬追新工具"],
    },
  ];
}

function comparisonSegments(
  input: GenerateInput,
  research: ResearchResult,
  highlights: Array<{ title: string; detail: string; sourceUrl: string }>,
  useCases: string[],
  hook: string,
): ScriptSegment[] {
  if (research.comparisonTargets?.length) {
    return multiToolComparisonSegments(input, research, highlights, useCases, hook);
  }

  const dimension = highlights[0]?.title ?? research.positioning ?? "核心能力";
  const scenario = useCases[0] ?? "真实工作流";
  return [
    {
      sceneType: "HOOK",
      title: `${input.name} 怎么选`,
      narration: `${hook} 这条按对比思路讲，但不做无证据排名，只看几个能帮你做选择的维度。`,
      bullets: ["不做无证据排名", "看选择维度", "看适合场景"],
    },
    {
      sceneType: "WEBSITE_DEMO",
      title: "先看官方定位",
      narration: `先看 ${input.name} 自己怎么定位。对比工具时，第一步不是问谁更强，而是看它主要服务什么任务。`,
      bullets: compactBullets([research.positioning, dimension], 3),
    },
    {
      sceneType: "COMPARISON",
      title: "对比维度一",
      narration: `第一个维度看 ${dimension}。如果你的核心问题正好在这里，它就比泛泛的全能工具更值得先试。`,
      bullets: compactBullets([dimension, highlights[0]?.detail], 3),
    },
    {
      sceneType: "WORKFLOW",
      title: "对比维度二",
      narration: `第二个维度看场景。它更适合 ${scenario}，所以选择时要从任务出发，不要只看功能数量。`,
      bullets: compactBullets([scenario, useCases[1], "从任务出发"], 3),
    },
    {
      sceneType: "RECOMMENDATION",
      title: "适合谁先试",
      narration: `如果你已经有这个场景，${input.name} 可以优先了解；如果只是想随便尝鲜，就先看免费试用和学习成本。`,
      bullets: compactBullets([scenario, "看学习成本", "先小范围试"], 3),
    },
    {
      sceneType: "CTA",
      title: "一句话结论",
      narration: `这类对比的重点不是争第一，而是找到哪个工具最适合你的任务。这个判断，比榜单排名更有用。`,
      bullets: ["不争第一", "匹配任务", "再决定试用"],
    },
  ];
}

function multiToolComparisonSegments(
  input: GenerateInput,
  research: ResearchResult,
  highlights: Array<{ title: string; detail: string; sourceUrl: string }>,
  useCases: string[],
  hook: string,
): ScriptSegment[] {
  const tools = [input.name, ...(research.comparisonTargets ?? []).map((target) => target.toolName)];
  const title = comparisonTitle(tools);
  const primaryPositioning = research.positioning ?? research.summary;
  const targetPositioning = (research.comparisonTargets ?? [])
    .map((target) => `${target.toolName}：${target.positioning ?? target.summary}`)
    .map((value) => fitDisplayText(value, 32))
    .filter((value): value is string => Boolean(value));
  const comparisonBasis = targetPositioning.length
    ? targetPositioning
    : compactBullets([primaryPositioning, highlights[0]?.title, useCases[0]], 3);
  const scenario = useCases[0] ?? research.comparisonTargets?.flatMap((target) => target.useCases)[0] ?? "真实任务";
  const dimension = highlights[0]?.title ?? "官方定位";

  return [
    {
      sceneType: "HOOK",
      title,
      narration: `${hook} 这条只做选择参考，不做无证据排名；先看它们各自服务什么任务。`,
      bullets: compactBullets([...tools, "不做无证据排名"], 4),
    },
    {
      sceneType: "COMPARISON",
      title: "先看官方定位",
      narration: `先看官方定位。${input.name} 可以理解成 ${shortClause(primaryPositioning)}；其他工具也要先按定位拆开看。`,
      bullets: compactBullets([`${input.name}：${primaryPositioning}`, ...comparisonBasis], 4),
    },
    {
      sceneType: "COMPARISON",
      title: "再看选择维度",
      narration: `第二步看选择维度。这里重点不是谁更强，而是 ${dimension} 和你的任务是不是贴合。`,
      bullets: compactBullets([dimension, scenario, "按任务匹配"], 4),
    },
    {
      sceneType: "WORKFLOW",
      title: "放进同一场景",
      narration: `第三步放进同一个场景里看。如果你的任务是 ${scenario}，就优先试最贴近这个流程的那个。`,
      bullets: compactBullets([scenario, "同一场景比较", "先小范围试"], 4),
    },
    {
      sceneType: "RECOMMENDATION",
      title: "怎么做选择",
      narration: `最后给判断方式：先排除定位不匹配的，再选一个最贴近当前任务的工具跑一遍。这个比收藏一堆名字更有效。`,
      bullets: ["排除不匹配", "选一个先跑", "再决定长期用"],
    },
    {
      sceneType: "CTA",
      title: "一句话结论",
      narration: `对比工具不要先问谁赢。先问你的任务是什么，再看哪个工具的定位和证据最接近这个任务。`,
      bullets: ["先看任务", "再看定位", "最后看证据"],
    },
  ];
}

function topListSegments(
  input: GenerateInput,
  research: ResearchResult,
  useCases: string[],
  hook: string,
): ScriptSegment[] {
  const topic = input.topic ?? input.name;
  return [
    {
      sceneType: "HOOK",
      title: `${topic} 怎么选`,
      narration: `${hook} 榜单型视频最怕变成空泛排名，所以这条先讲筛选标准，再讲适合场景。`,
      bullets: ["先讲标准", "再讲场景", "不做无证据排名"],
    },
    {
      sceneType: "TOOL_LIST",
      title: "筛选标准",
      narration: `先定标准。看 ${topic}，至少要看三个问题：解决什么任务、学习成本多高、能不能进入你的工作流。`,
      bullets: ["解决什么任务", "学习成本", "能否进工作流"],
    },
    {
      sceneType: "WORKFLOW",
      title: "按场景分类",
      narration: `再按场景分。${toChineseList((useCases.length ? useCases : research.useCases ?? []).slice(0, 3))}，这些场景不能混在一起比较。`,
      bullets: compactBullets(useCases.length ? useCases : research.useCases ?? [], 4),
    },
    {
      sceneType: "RECOMMENDATION",
      title: "试用顺序",
      narration: `最后给试用顺序：先选最贴近当前任务的一个工具，小范围跑一次，再决定要不要换成长期工作流。`,
      bullets: ["先选一个", "小范围跑一次", "再长期使用"],
    },
    {
      sceneType: "CTA",
      title: "榜单怎么记",
      narration: `记住，工具榜单不是让你收藏一堆名字，而是帮你更快排除不适合的工具。`,
      bullets: ["少收藏名字", "多排除不适合", "围绕任务选"],
    },
  ];
}

function websiteDemoSegments(
  input: GenerateInput,
  research: ResearchResult,
  highlights: Array<{ title: string; detail: string; sourceUrl: string }>,
  hook: string,
): ScriptSegment[] {
  return [
    {
      sceneType: "HOOK",
      title: `${input.name} 官网速看`,
      narration: `${hook} 这条主要看官网和产品页面，快速判断它主打什么，不把它讲成纯文字介绍。`,
      bullets: compactBullets([research.positioning, highlights[0]?.title], 3),
    },
    {
      sceneType: "LANDING_PAGE_DEMO",
      title: "首屏看定位",
      narration: `先看首屏。一个工具的首屏通常会告诉你：它想服务谁，以及最想让你记住什么。`,
      bullets: ["首屏定位", "服务对象", "主打信息"],
    },
    {
      sceneType: "PRODUCT_PAGE_SCROLL",
      title: "往下看功能",
      narration: `再往下看功能页。重点不是每个模块都读一遍，而是找有没有和真实任务相关的能力。`,
      bullets: compactBullets([highlights[0]?.title, highlights[1]?.title, "真实任务相关"], 3),
    },
    {
      sceneType: "SELLING_POINT",
      title: naturalTitle(highlights[0]?.title, "核心判断"),
      narration: `看完页面之后，最值得记住的是：${highlights[0]?.detail ?? research.summary}`,
      bullets: compactBullets([highlights[0]?.title, highlights[0]?.detail], 3),
    },
    {
      sceneType: "CTA",
      title: "官网速看结论",
      narration: `所以看 ${input.name}，先抓定位，再抓一个核心能力，最后再决定要不要深入试用。`,
      bullets: ["抓定位", "抓核心能力", "再试用"],
    },
  ];
}

function updateNewsSegments(
  input: GenerateInput,
  research: ResearchResult,
  highlights: Array<{ title: string; detail: string; sourceUrl: string }>,
  useCases: string[],
  hook: string,
): ScriptSegment[] {
  const update = highlights[0]?.title ?? "最近值得关注的变化";
  return [
    {
      sceneType: "HOOK",
      title: `${input.name} 更新速看`,
      narration: `${hook} 这条按更新速递讲，只看这次变化会影响什么场景，不夸大成颠覆式结论。`,
      bullets: ["只看变化", "看影响场景", "不夸大结论"],
    },
    {
      sceneType: "WEBSITE_DEMO",
      title: "先找更新来源",
      narration: `先看官方页面、博客或 changelog。更新类内容一定要先找来源，再讲它可能带来的影响。`,
      bullets: ["官方来源", "更新内容", "影响判断"],
    },
    {
      sceneType: "FEATURE",
      title: naturalTitle(update, "更新重点"),
      narration: `这次最值得看的变化是 ${update}。如果你已经在用 ${input.name}，这里可能会影响日常流程。`,
      bullets: compactBullets([update, highlights[0]?.detail], 3),
    },
    {
      sceneType: "WORKFLOW",
      title: "影响什么场景",
      narration: `它可能影响的场景是 ${toChineseList(useCases.slice(0, 2))}。如果你不用这些场景，就不用急着跟进。`,
      bullets: compactBullets([useCases[0], useCases[1], "不用急着跟进"], 3),
    },
    {
      sceneType: "CTA",
      title: "要不要更新",
      narration: `最后判断：更新值得知道，但不一定马上迁移。先看它有没有解决你正在遇到的问题。`,
      bullets: ["值得知道", "不急迁移", "看真实问题"],
    },
  ];
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

function comparisonTitle(tools: string[]): string {
  const clean = tools.filter(Boolean).slice(0, 3);
  if (clean.length <= 1) {
    return `${clean[0] ?? "工具"} 怎么选`;
  }
  if (clean.length === 2) {
    return `${clean[0]} vs ${clean[1]}`;
  }
  return `${clean[0]} 等工具怎么选`;
}

function shortClause(value: string): string {
  return fitDisplayText(
    value
      .replace(/[。.!！?？]$/, "")
      .replace(/^.+?是一个?/, "")
      .replace(/^.+?是一款/, ""),
    34,
  ) ?? "一个需要按场景判断的工具";
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
