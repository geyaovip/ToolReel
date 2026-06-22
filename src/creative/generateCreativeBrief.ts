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
    id: "what-it-does",
    title: "先讲清楚它到底干什么",
    thesis: "这条视频优先让用户在最短时间内知道工具的定位、解决的问题和适用场景。",
    audience: "想快速判断一个 AI 工具是干什么的人",
    hook: "先别急着看功能列表，先用一句话讲清楚它到底解决什么问题。",
    tone: "practical",
    keywords: ["定位", "主打", "工具", "产品", "解决", "场景", "官网", "AI"],
  },
  {
    id: "workflow-fit",
    title: "放进真实工作流里看",
    thesis: "工具科普不能只讲功能名，要解释它能进入哪个真实工作流、替用户处理哪一步。",
    audience: "已经有真实工作任务、想减少重复劳动的人",
    hook: "一个工具值不值得知道，关键看它能不能放进你的真实工作流。",
    tone: "workflow",
    keywords: ["workflow", "agent", "自动", "任务", "项目", "代码库", "开发", "协作", "流程"],
  },
  {
    id: "key-difference",
    title: "讲一个最关键的差异点",
    thesis: "同类工具看起来容易相似，科普视频要抓住一个最关键差异，而不是铺很多泛泛卖点。",
    audience: "试过不少 AI 工具、但还没找到稳定工作流的人",
    hook: "这类工具最容易讲成一堆卖点，但真正需要看的是一个关键差异。",
    tone: "contrarian",
    keywords: ["理解", "上下文", "安全", "权限", "集成", "审查", "搜索", "知识"],
  },
  {
    id: "scenario-first",
    title: "用场景解释工具价值",
    thesis: "用户最容易听懂的是具体场景：谁会用、什么时候用、它帮你少做哪一步。",
    audience: "每天处理重复任务、文档、代码或内容流程的人",
    hook: "别先问它功能多不多，先看它在哪个场景里真的有用。",
    tone: "practical",
    keywords: ["效率", "省时间", "重复", "快速", "生成", "自动化", "搜索", "答案"],
  },
  {
    id: "team-trust",
    title: "团队使用要看可控性",
    thesis: "如果工具面向团队或企业，科普时要讲清楚安全、权限、协作和可控性，而不是只讲酷炫功能。",
    audience: "团队负责人、企业用户和需要稳定交付的人",
    hook: "个人用工具看功能，团队要用就得多看一层。",
    tone: "trust",
    keywords: ["SOC", "SSO", "安全", "隐私", "权限", "团队", "企业", "控制"],
  },
  {
    id: "quick-map",
    title: "一分钟建立工具地图",
    thesis: "少讲大而全，直接讲定位、核心功能点和使用场景，让用户形成工具地图。",
    audience: "想快速筛选 AI 工具的人",
    hook: "这条不做产品说明书，只帮你快速建立这个工具的基本地图。",
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
    ...(research.insights ?? []).flatMap((item) => [item.title, item.detail, item.category]),
    ...(research.evidence ?? []).map((item) => item.text),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const proofPool = buildProofPool(research);
  if (input.type === "news" || input.type === "update_news") {
    return buildNewsCreativeBrief(input, research, proofPool);
  }
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

function buildNewsCreativeBrief(
  input: GenerateInput,
  research: ResearchResult,
  proofPool: string[],
): CreativeBrief {
  const headline = research.insights?.[0]?.title ?? research.highlights?.[0]?.title ?? research.sourcePages?.[0]?.title ?? input.name;
  const angle: CreativeAngle = {
    id: "news-impact",
    title: "先讲发生了什么，再讲影响",
    thesis: "资讯视频先确认官方事实，再用最少信息讲清核心变化、影响对象和跟进价值。",
    audience: "想快速理解 AI 行业新发布和产品变化的人",
    hook: "别只看热搜标题，先看官方到底发布了什么。",
    tone: "curious",
    score: 100,
    proofPoints: proofPool.slice(0, 4),
    watchOuts: [
      "不使用无法从来源确认的刚刚、重磅、颠覆等措辞",
      "不把尚未开放的能力写成所有用户已经可用",
      "不把推测写成官方结论",
      "不复读整篇发布稿，只保留核心变化和影响",
    ],
  };
  return {
    toolName: input.name,
    generatedAt: new Date().toISOString(),
    selectedAngle: angle,
    candidateAngles: [angle],
    sceneBeats: [
      {
        sceneType: "HOOK",
        intent: "用一句话讲清这次发生了什么",
        visualFocus: "新闻主体、核心变化、强判断标题",
        narrationHint: angle.hook,
        onScreenFocus: [cleanText(headline, 22) ?? input.name, "发生了什么"],
      },
      {
        sceneType: "WEBSITE_DEMO",
        intent: "展示官方发布页，建立资讯可信度",
        visualFocus: "官方原文、发布页面、关键证据",
        narrationHint: "先确认官方来源，再解释变化。",
        onScreenFocus: ["官方来源", "关键证据"],
      },
      {
        sceneType: "FEATURE",
        intent: "提炼最值得知道的核心变化",
        visualFocus: "核心变化、能力重点、信息对比",
        narrationHint: proofPool[0] ?? headline,
        onScreenFocus: [proofPool[0] ?? headline, "核心变化"],
      },
      {
        sceneType: "WORKFLOW",
        intent: "解释谁会受到影响以及对应场景",
        visualFocus: "影响对象、真实场景、使用变化",
        narrationHint: research.useCases?.[0] ?? "看它是否进入真实任务",
        onScreenFocus: [research.useCases?.[0] ?? "谁需要关注", "看真实任务"],
      },
      {
        sceneType: "RECOMMENDATION",
        intent: "给出是否值得跟进的克制判断",
        visualFocus: "是否开放、真实问题、跟进建议",
        narrationHint: "知道消息和立刻迁移是两件事。",
        onScreenFocus: ["确认是否开放", "再决定跟进"],
      },
    ],
    coverIdeas: [
      {
        title: `${input.name} 发布了什么`,
        subtitle: "三点讲清核心变化",
        rationale: "资讯型封面，直接给出事件和阅读收益。",
      },
      {
        title: `${input.name} 新消息`,
        subtitle: "谁需要关注",
        rationale: "影响型封面，强调与用户的关系。",
      },
    ],
  };
}

function scoreAngle(seed: AngleSeed, corpus: string, proofPool: string[]): CreativeAngle {
  const keywordScore = seed.keywords.reduce(
    (score, keyword) => score + (corpus.includes(keyword.toLowerCase()) ? 2 : 0),
    0,
  );
  const proofScore = Math.min(8, proofPool.length * 1.2);
  const explainerBaseScore = seed.id === "what-it-does" ? 5 : seed.id === "quick-map" ? 3 : 2;

  return {
    id: seed.id,
    title: seed.title,
    thesis: seed.thesis,
    audience: seed.audience,
    hook: seed.hook,
    tone: seed.tone,
    score: Math.round((keywordScore + proofScore + explainerBaseScore) * 10) / 10,
    proofPoints: proofPool.slice(0, 4),
    watchOuts: [
      "不要编造价格、用户评价或未验证商业信息",
      "不要把官网定位改写成夸张承诺",
      "不要做成生硬的产品功能清单",
      "不要为了种草而牺牲工具科普信息密度",
    ],
  };
}

function buildProofPool(research: ResearchResult): string[] {
  return [
    ...(research.insights ?? []).map((item) => item.title),
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
  const useCase =
    research.insights?.find((item) => item.category === "use_case" || item.category === "workflow")?.title ??
    research.useCases?.[0] ??
    research.targetUsers[0] ??
    "真实工作场景";

  return [
    {
      sceneType: "HOOK",
      intent: "用一句话讲清楚工具定位，不铺产品说明书",
      visualFocus: "工具名、官网截图、定位判断句",
      narrationHint: angle.hook,
      onScreenFocus: [shortCoverLine(input.name, angle), cleanText(strongestProof, 20) ?? "先讲清楚它干什么"],
    },
    {
      sceneType: "WEBSITE_DEMO",
      intent: "快速建立可信来源，并解释官网主打什么",
      visualFocus: "官网入口、首屏定位、产品界面",
      narrationHint: "先看官网入口，只抓定位和可信证据。",
      onScreenFocus: ["官网首屏", "产品定位", "产品界面"],
    },
    {
      sceneType: "SELLING_POINT",
      intent: "解释一个最关键功能点，不罗列所有卖点",
      visualFocus: "核心功能点、对应用户收益",
      narrationHint: strongestProof,
      onScreenFocus: [cleanText(strongestProof, 20) ?? "核心亮点", cleanText(secondProof, 20) ?? "真实收益"],
    },
    {
      sceneType: "WORKFLOW",
      intent: "落到具体使用场景，避免抽象介绍",
      visualFocus: "使用场景、流程箭头、任务前后变化",
      narrationHint: useCase,
      onScreenFocus: [cleanText(useCase, 22) ?? "真实工作场景", "不是只看功能"],
    },
    {
      sceneType: "CTA",
      intent: "用一句话总结它适合谁，以及用户该记住什么",
      visualFocus: "适合谁、记住什么、下一步怎么判断",
      narrationHint: "最后给用户一个清晰记忆点。",
      onScreenFocus: ["记住核心场景", "再决定要不要试"],
    },
  ];
}

function buildCoverIdeas(input: GenerateInput, angle: CreativeAngle): CoverIdea[] {
  const title = shortCoverLine(input.name, angle);
  return [
    {
      title,
      subtitle: angle.id === "workflow-fit" ? "关键看工作流" : "一分钟讲清楚",
      rationale: `自动选择角度：${angle.title}`,
    },
    {
      title: `${input.name} 是干啥的`,
      subtitle: "先看核心场景",
      rationale: "科普型封面，用于快速建立产品认知。",
    },
  ];
}

function shortCoverLine(toolName: string, angle: CreativeAngle): string {
  if (angle.id === "what-it-does") {
    return `${toolName} 是干啥的`;
  }
  if (angle.id === "workflow-fit") {
    return `${toolName} 怎么用`;
  }
  if (angle.id === "key-difference") {
    return `${toolName} 关键看这里`;
  }
  if (angle.id === "team-trust") {
    return `${toolName} 适合团队吗`;
  }
  if (angle.id === "scenario-first") {
    return `${toolName} 适合谁用`;
  }
  return `${toolName} 快速科普`;
}

function cleanText(value: string | undefined, maxChars: number): string | undefined {
  const normalized = value?.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxChars ? normalized : undefined;
}
