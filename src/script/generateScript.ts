import type { GenerateInput, ResearchResult, ScriptData } from "../types.ts";

export async function generateScript(
  input: GenerateInput,
  research: ResearchResult,
): Promise<ScriptData> {
  return {
    toolName: input.name,
    videoType: input.type,
    hook: `这个 AI 工具，正在改变很多人的工作方式。`,
    coreSellingPoint: `${input.name} 可以帮你更快完成从想法到结果的流程。`,
    segments: [
      {
        sceneType: "HOOK",
        title: input.name,
        narration: `这个 AI 工具，正在改变很多人的工作方式。`,
        bullets: ["AI 工具发现", "效率提升", "快速上手"],
      },
      {
        sceneType: "PROBLEM",
        title: "它解决什么问题",
        narration: "过去了解一个新工具，需要反复查官网、看教程、整理卖点。",
        bullets: ["信息分散", "上手成本高", "很难快速判断价值"],
      },
      {
        sceneType: "WEBSITE_DEMO",
        title: "官网与产品展示",
        narration: "先看官网和产品界面，快速判断它适合什么场景。",
        bullets: [research.officialUrl, "官网截图占位", "产品界面占位"],
      },
      {
        sceneType: "SELLING_POINT",
        title: "核心卖点",
        narration: research.sellingPoints.join("，"),
        bullets: research.sellingPoints,
      },
      {
        sceneType: "TARGET_USER",
        title: "适合谁用",
        narration: `${input.name} 更适合这些想把 AI 真正用进工作流的人。`,
        bullets: research.targetUsers.slice(0, 4),
      },
      {
        sceneType: "CTA",
        title: "结尾引导",
        narration: `如果你也想用 AI 提升效率，可以先从 ${input.name} 试起。`,
        bullets: ["先收藏", "再试用", "关注更多 AI 工具"],
      },
    ],
  };
}

