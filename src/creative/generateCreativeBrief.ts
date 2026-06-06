import type {
  CoverIdea,
  CreativeAngle,
  CreativeBrief,
  CreativeSceneBeat,
  GenerateInput,
  ResearchResult,
} from "../types.ts";

type AngleSeed = Omit<CreativeAngle, "score" | "proofPoints" | "watchOuts"> & {
  keywords: string[];
};

const angleSeeds: AngleSeed[] = [
  {
    id: "workflow-shift",
    title: "不是功能介绍，是工作流变化",
    thesis: "这个工具真正值得看的是它能不能进入真实工作流，而不是多列几个功能。",
    audience: "已经有真实工作任务、想减少重复劳动的人",
    hook: "如果你还只是把它当成一个功能工具，可能低估它了。",
    tone: "workflow",
    keywords: ["workflow", "agent", "自动", "任务", "项目", "代码库", "开发", "协作", "流程"],
  },
  {
    id: "hidden-difference",
    title: "别只看表层，差距在细节里",
    thesis: "同类工具看起来都差不多，真正拉开差距的是上下文理解、协作和落地细节。",
    audience: "试过不少 AI 工具、但还没找到稳定工作流的人",
    hook: "这类工具最容易看错，因为表面功能都很像。",
    tone: "contrarian",
    keywords: ["理解", "上下文", "安全", "权限", "集成", "审查", "搜索", "知识"],
  },
  {
    id: "time-saver",
    title: "省时间不是口号，要看具体场景",
    thesis: "判断它值不值得用，不看宣传语，直接看它能替你省掉哪类重复步骤。",
    audience: "每天处理重复任务、文档、代码或内容流程的人",
    hook: "一个工具是不是真的省时间，要看它替你省掉哪一步。",
    tone: "practical",
    keywords: ["效率", "省时间", "重复", "快速", "生成", "自动化", "搜索", "答案"],
  },
  {
    id: "team-trust",
    title: "适合团队前，先看可信度",
    thesis: "如果要放进团队流程，功能之外还要看安全、权限、协作和可控性。",
    audience: "团队负责人、企业用户和需要稳定交付的人",
    hook: "个人试用看功能，团队要用就得多看一层。",
    tone: "trust",
    keywords: ["SOC", "SSO", "安全", "隐私", "权限", "团队", "企业", "控制"],
  },
  {
    id: "quick-judgment",
    title: "一分钟判断值不值得试",
    thesis: "少讲大而全，直接用定位、核心场景和一个关键亮点判断它值不值得打开。",
    audience: "想快速筛选 AI 工具的人",
    hook: "这条不做产品说明书，只帮你快速判断它值不值得试。",
    tone: "curious",
    keywords: ["AI", "工具", "官网", "产品", "亮点", "场景"],
  },
];

export async function generateCreativeBrief(
  input: GenerateInput,
  research: ResearchResult,
): Promise<CreativeBrief> {
  const corpus = [
    research.summary,
    research.positioning,
    ...research.sellingPoints,
    ...research.targetUsers,
    ...(research.useCases ?? []),
    ...(research.highlights ?? []).flatMap((item) => [item.title, item.detail]),
    ...(research.evidence ?? []).map((item) => item.text),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const proofPool = buildProofPool(research);
  const candidateAngles = angleSeeds
    .map((seed) => scoreAngle(seed, corpus, proofPool))
    .sort((a, b) => b.score - a.score);
  const selectedAngle = candidateAngles[0] ?? scoreAngle(angleSeeds.at(-1)!, corpus, proofPool);

  return {
    toolName: input.name,
    generatedAt: new Date().toISOString(),
    selectedAngle,
    candidateAngles: candidateAngles.slice(0, 4),
    sceneBeats: buildSceneBeats(input, research, selectedAngle),
    coverIdeas: buildCoverIdeas(input, selectedAngle),
  };
}

function scoreAngle(seed: AngleSeed, corpus: string, proofPool: string[]): CreativeAngle {
  const keywordScore = seed.keywords.reduce(
    (score, keyword) => score + (corpus.includes(keyword.toLowerCase()) ? 2 : 0),
    0,
  );
  const proofScore = Math.min(8, proofPool.length * 1.2);
  const specificityScore = seed.id === "quick-judgment" ? 1 : 3;

  return {
    id: seed.id,
    title: seed.title,
    thesis: seed.thesis,
    audience: seed.audience,
    hook: seed.hook,
    tone: seed.tone,
    score: Math.round((keywordScore + proofScore + specificityScore) * 10) / 10,
    proofPoints: proofPool.slice(0, 4),
    watchOuts: [
      "不要编造价格、用户评价或未验证商业信息",
      "不要把官网定位改写成夸张承诺",
      "不要做成产品功能清单",
    ],
  };
}

function buildProofPool(research: ResearchResult): string[] {
  return [
    ...(research.highlights ?? []).map((item) => item.title),
    ...research.sellingPoints,
    ...(research.useCases ?? []),
    research.positioning,
    research.summary,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => cleanText(value, 34))
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);
}

function buildSceneBeats(
  input: GenerateInput,
  research: ResearchResult,
  angle: CreativeAngle,
): CreativeSceneBeat[] {
  const strongestProof = angle.proofPoints[0] ?? research.sellingPoints[0] ?? research.summary;
  const secondProof = angle.proofPoints[1] ?? research.sellingPoints[1] ?? strongestProof;
  const useCase = research.useCases?.[0] ?? research.targetUsers[0] ?? "真实工作场景";

  return [
    {
      sceneType: "HOOK",
      intent: "用一个自媒体判断开场，不铺产品说明书",
      visualFocus: "工具名、官网截图、最强判断句",
      narrationHint: angle.hook,
      onScreenFocus: [shortCoverLine(input.name, angle), cleanText(strongestProof, 20) ?? "先看真实场景"],
    },
    {
      sceneType: "WEBSITE_DEMO",
      intent: "快速建立可信来源和产品气质",
      visualFocus: "官网入口、首屏定位、产品界面",
      narrationHint: "先看官网入口，只抓定位和可信证据。",
      onScreenFocus: [displayUrl(research.officialUrl), "官网首屏", "产品气质"],
    },
    {
      sceneType: "SELLING_POINT",
      intent: "把核心亮点翻译成用户能感知的收益",
      visualFocus: "核心能力卡片、重点词高亮",
      narrationHint: strongestProof,
      onScreenFocus: [cleanText(strongestProof, 20) ?? "核心亮点", cleanText(secondProof, 20) ?? "真实收益"],
    },
    {
      sceneType: "WORKFLOW",
      intent: "落到具体使用场景，避免抽象种草",
      visualFocus: "使用场景、流程箭头、任务前后变化",
      narrationHint: useCase,
      onScreenFocus: [cleanText(useCase, 22) ?? "真实工作场景", "不是只看功能"],
    },
    {
      sceneType: "CTA",
      intent: "给出判断方法，而不是硬广 CTA",
      visualFocus: "适合谁、先试什么、如何判断",
      narrationHint: "最后给用户一个试用判断标准。",
      onScreenFocus: ["先试核心场景", "再决定要不要继续用"],
    },
  ];
}

function buildCoverIdeas(input: GenerateInput, angle: CreativeAngle): CoverIdea[] {
  const title = shortCoverLine(input.name, angle);
  return [
    {
      title,
      subtitle: angle.id === "workflow-shift" ? "真正强在工作流" : "一分钟判断值不值得试",
      rationale: `自动选择角度：${angle.title}`,
    },
    {
      title: `${input.name} 值得试吗`,
      subtitle: "先看这一个核心场景",
      rationale: "保守判断型封面，用于降低夸张感。",
    },
  ];
}

function shortCoverLine(toolName: string, angle: CreativeAngle): string {
  if (angle.id === "workflow-shift") {
    return `别只把 ${toolName} 当工具`;
  }
  if (angle.id === "hidden-difference") {
    return `${toolName} 真正差距在这里`;
  }
  if (angle.id === "team-trust") {
    return `${toolName} 适合团队吗`;
  }
  if (angle.id === "time-saver") {
    return `${toolName} 省时间吗`;
  }
  return `${toolName} 值得试吗`;
}

function cleanText(value: string | undefined, maxChars: number): string | undefined {
  const normalized = value?.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxChars ? normalized : undefined;
}

function displayUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
