import type { GenerateInput, ResearchResult } from "../types.ts";

export async function researchTool(input: GenerateInput): Promise<ResearchResult> {
  return {
    toolName: input.name,
    officialUrl: input.url,
    summary: `${input.name} 是一个用于提升 AI 工作效率的工具。本阶段使用 mock research，后续替换为真实信息整理。`,
    pricing: "unknown",
    targetUsers: ["独立开发者", "产品经理", "前端工程师", "AI 工作流搭建者"],
    sellingPoints: [
      "快速理解工具核心价值",
      "减少手动整理和剪辑",
      "适合短视频平台种草",
    ],
  };
}

