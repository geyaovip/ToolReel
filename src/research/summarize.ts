import type { ExtractedPage } from "./pageExtract.ts";
import type { ResearchEvidence, ResearchHighlight } from "../types.ts";

const VALUE_WORDS = [
  "ai",
  "agent",
  "automate",
  "自动",
  "智能",
  "code",
  "coding",
  "workflow",
  "team",
  "fast",
  "secure",
  "collabor",
  "integrat",
  "developer",
  "productivity",
  "效率",
  "团队",
];

const PRICING_WORDS = ["free", "pricing", "price", "plan", "trial", "免费", "价格", "套餐", "$"];

export function summarizePages(toolName: string, pages: ExtractedPage[]): {
  summary: string;
  positioning: string;
  highlights: ResearchHighlight[];
  sellingPoints: string[];
  targetUsers: string[];
  useCases: string[];
  pricing: "unknown" | string;
  evidence: ResearchEvidence[];
  unknowns: string[];
} {
  const allBlocks = pages.flatMap((page) =>
    page.textBlocks.map((text) => ({
      text,
      sourceUrl: page.url,
      score: scoreText(text, toolName),
    })),
  );
  const ranked = allBlocks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const evidence = ranked.slice(0, 8).map(({ text, sourceUrl }) => ({ text, sourceUrl }));
  const positioning = pickPositioning(toolName, pages, ranked.map((item) => item.text));
  const highlights = buildHighlights(toolName, ranked);
  const sellingPoints = highlights.map((item) => item.title).slice(0, 5);
  const targetUsers = inferTargetUsers(ranked.map((item) => item.text).join(" "));
  const useCases = inferUseCases(ranked.map((item) => item.text).join(" "));
  const pricing = inferPricing(pages);
  const summary = buildSummary(toolName, positioning, highlights);

  return {
    summary,
    positioning,
    highlights,
    sellingPoints,
    targetUsers,
    useCases,
    pricing,
    evidence,
    unknowns: evidence.length ? [] : ["官网文本不足，无法可靠提炼更多亮点。"],
  };
}

function scoreText(text: string, toolName: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  if (lower.includes(toolName.toLowerCase())) score += 2;
  for (const word of VALUE_WORDS) {
    if (lower.includes(word)) score += 2;
  }
  if (/^[A-Z][A-Za-z0-9 ]{3,80}$/.test(text)) score += 1;
  if (text.length > 28 && text.length < 150) score += 1;
  if (/cookie|login|sign in|contact sales|download/i.test(text)) score -= 2;
  return score;
}

function pickPositioning(toolName: string, pages: ExtractedPage[], rankedText: string[]): string {
  const meta = pages.find((page) => page.description)?.description;
  const h1 = pages[0]?.textBlocks.find((block) => block.toLowerCase().includes(toolName.toLowerCase()));
  return chineseAngleFor(toolName, meta || h1 || rankedText[0])?.detail || `${toolName} 是一个值得关注的工具。`;
}

function buildHighlights(
  toolName: string,
  ranked: Array<{
    text: string;
    sourceUrl: string;
  }>,
): ResearchHighlight[] {
  const highlights: ResearchHighlight[] = [];
  const seen = new Set<string>();

  for (const item of ranked) {
    const angle = chineseAngleFor(toolName, item.text);
    if (!angle || seen.has(angle.title)) {
      continue;
    }
    seen.add(angle.title);
    highlights.push({
      ...angle,
      sourceUrl: item.sourceUrl,
    });
    if (highlights.length >= 5) {
      break;
    }
  }

  return highlights.length
    ? highlights
    : ranked.slice(0, 3).map((item) => ({
        title: toShortTitle(item.text),
        detail: cleanSentence(item.text, 72),
        sourceUrl: item.sourceUrl,
      }));
}

function inferTargetUsers(text: string): string[] {
  const lower = text.toLowerCase();
  const users: string[] = [];
  if (/developer|code|coding|工程师|开发/.test(lower)) users.push("开发者和工程师");
  if (/team|enterprise|company|团队|企业/.test(lower)) users.push("团队和企业用户");
  if (/design|product|产品/.test(lower)) users.push("产品和设计团队");
  if (/student|learn|教育|学习/.test(lower)) users.push("学习新工具的人");
  if (/creator|content|video|创作|内容/.test(lower)) users.push("内容创作者");
  return users.length ? users.slice(0, 4) : ["想快速判断工具价值的人", "正在提升 AI 工作流的人"];
}

function inferUseCases(text: string): string[] {
  const lower = text.toLowerCase();
  const cases: string[] = [];
  if (/code|coding|developer|工程|代码/.test(lower)) cases.push("辅助写代码、理解项目和推进开发任务");
  if (/agent|automate|自动|智能体/.test(lower)) cases.push("把重复流程交给 AI agent 处理");
  if (/docs|knowledge|search|文档|搜索/.test(lower)) cases.push("从文档和知识里快速找到答案");
  if (/team|collabor|团队|协作/.test(lower)) cases.push("让团队在同一套工具里协作");
  if (/secure|privacy|enterprise|安全|企业/.test(lower)) cases.push("在更重视安全和权限的场景使用");
  return cases.slice(0, 4);
}

function inferPricing(pages: ExtractedPage[]): "unknown" | string {
  const pricingPages = pages.filter((page) => /pricing|price|plan/i.test(page.url));
  const pricingBlocks = pricingPages.flatMap((page) => page.textBlocks);
  if (!pricingBlocks.length) {
    return "unknown";
  }

  const joined = pricingBlocks.join(" ");
  const parts: string[] = [];
  if (/\bHobby\b[^.]{0,60}\bFree\b|\bFree\b/i.test(joined)) parts.push("Hobby/免费入门");
  if (/\$20\s*\/?\s*mo|\$20/i.test(joined)) parts.push("Individual 约 $20/月");
  if (/\$40\s*\/?\s*user\s*\/?\s*mo|\$40/i.test(joined)) parts.push("Teams 约 $40/用户/月");
  if (/Enterprise|Contact sales|contact us/i.test(joined)) parts.push("Enterprise 需联系销售");

  if (!parts.length) {
    return "unknown";
  }
  return `官网 Pricing 页面显示：${parts.join("；")}。`;
}

function buildSummary(toolName: string, positioning: string, highlights: ResearchHighlight[]): string {
  const leading = positioning.endsWith("。") ? positioning : `${positioning}。`;
  const highlight = highlights[0]?.title;
  return highlight ? `${leading} 核心看点是：${highlight}。` : `${leading} 可以先从官网和产品界面判断适用场景。`;
}

function toShortTitle(text: string): string {
  const cleaned = cleanSentence(text, 34);
  return cleaned.replace(/[。.!！?？]$/, "");
}

function chineseAngleFor(toolName: string, text: string | undefined): { title: string; detail: string } | undefined {
  if (!text) {
    return undefined;
  }
  const lower = text.toLowerCase();
  if (/plans?,? writes?,? and reviews? code|plan.*write.*review|coding agent|codebase/.test(lower)) {
    return {
      title: "AI agent 参与开发任务",
      detail: `${toolName} 主打让 AI 理解代码库，并参与规划、编写和审查代码。`,
    };
  }
  if (/tab|completion|autocomplete|frontier models|mcp|skills|hooks/.test(lower)) {
    return {
      title: "把补全和工具能力串进编辑器",
      detail: `${toolName} 不只是聊天窗口，还把补全、模型能力和工具调用放进开发流程里。`,
    };
  }
  if (/cloud agents?|automation|auto-run|browser|network controls?/.test(lower)) {
    return {
      title: "云端 agent 和自动化能力",
      detail: `${toolName} 提到云端 agent、自动化和运行控制，适合处理更长的开发任务。`,
    };
  }
  if (/pr throughput|code review|bugbot|review/.test(lower)) {
    return {
      title: "团队代码审查和交付效率",
      detail: `${toolName} 强调代码审查、团队协作和 PR 效率，适合多人开发场景。`,
    };
  }
  if (/soc 2|zero data retention|saml|oidc|privacy|enterprise|audit logs|access controls?/.test(lower)) {
    return {
      title: "企业级安全和权限控制",
      detail: `${toolName} 官网强调 SOC 2、隐私模式、SSO 和访问控制，更适合企业团队评估。`,
    };
  }
  if (/desktop|cli|web|mobile|everywhere/.test(lower)) {
    return {
      title: "覆盖多个使用入口",
      detail: `${toolName} 覆盖桌面、CLI、Web 等入口，方便在不同工作场景里继续使用。`,
    };
  }
  if (/extraordinarily productive|productive|productivity|best coding/.test(lower)) {
    return {
      title: "提升开发者生产力",
      detail: `${toolName} 的核心定位是提升开发者生产力，重点不是展示概念，而是进入日常写代码流程。`,
    };
  }
  return undefined;
}

function cleanSentence(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxChars - 1)}…`;
}
