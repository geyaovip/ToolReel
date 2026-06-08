import type { GenerateInput, ResearchResult } from "../types.ts";
import { extractPage, pickRelevantInternalLinks, type ExtractedPage } from "./pageExtract.ts";
import { summarizePages } from "./summarize.ts";

export async function researchTool(input: GenerateInput): Promise<ResearchResult> {
  const officialUrl = normalizeUrl(input.url);
  const notes: string[] = [];
  const pages: ExtractedPage[] = [];
  const homepage = await fetchExtractedPage(officialUrl, notes);
  if (homepage) {
    pages.push(homepage);
    const links = pickRelevantInternalLinks(homepage, 8);
    for (const link of links) {
      const page = await fetchExtractedPage(link.url, notes);
      if (page) {
        pages.push(page);
      }
    }
  }

  if (!pages.length) {
    return fallbackResearch(input, officialUrl, notes);
  }

  const summary = summarizePages(input.name, pages);
  const confidence = confidenceFor(pages, summary.evidence.length);
  return {
    toolName: input.name,
    officialUrl,
    summary: summary.summary,
    pricing: summary.pricing,
    confidence,
    targetUsers: summary.targetUsers,
    sellingPoints: summary.sellingPoints,
    positioning: summary.positioning,
    highlights: summary.highlights,
    useCases: summary.useCases,
    evidence: summary.evidence,
    sourcePages: pages.map((page) => ({
      url: page.url,
      kind: page.url === officialUrl ? "homepage" : classifyPageKind(page.url, homepage?.links),
      title: page.title,
      description: page.description,
      extractedTextLength: page.textBlocks.join("").length,
    })),
    unknowns: summary.unknowns,
    notes,
  };
}

function classifyPageKind(url: string, links: ExtractedPage["links"] | undefined): ResearchResult["sourcePages"][number]["kind"] {
  return links?.find((link) => stripUrl(link.url) === stripUrl(url))?.kind ?? "other";
}

function stripUrl(url: string): string {
  return url.replace(/#.*$/, "").replace(/\/$/, "");
}

async function fetchExtractedPage(url: string, notes: string[]): Promise<ExtractedPage | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ToolReel/0.1 research collector",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      notes.push(`Research fetch skipped ${url}: HTTP ${response.status}`);
      return undefined;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      notes.push(`Research fetch skipped ${url}: ${contentType || "non-html response"}`);
      return undefined;
    }
    return extractPage(await response.text(), url);
  } catch (error) {
    notes.push(`Research fetch failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function fallbackResearch(input: GenerateInput, officialUrl: string, notes: string[]): ResearchResult {
  return {
    toolName: input.name,
    officialUrl,
    summary: `${input.name} 是一个值得快速了解的 AI 工具，本期先用官网入口和基础信息做快速判断。`,
    pricing: "unknown",
    confidence: "low",
    targetUsers: ["想快速判断 AI 工具价值的人"],
    sellingPoints: ["先看定位", "再看核心场景", "最后判断是否值得试用"],
    positioning: `${input.name} 是一个值得快速了解的 AI 工具。`,
    highlights: [],
    useCases: [],
    evidence: [],
    sourcePages: [],
    unknowns: ["官网文本抓取失败，不能可靠判断产品亮点、价格或适用人群。"],
    notes,
  };
}

function confidenceFor(pages: ExtractedPage[], evidenceCount: number): ResearchResult["confidence"] {
  const usefulPages = pages.filter((page) => page.textBlocks.join("").length > 200);
  const hasDeepPage = pages.some((page) => page.url !== pages[0]?.url);
  if (usefulPages.length >= 3 && evidenceCount >= 5 && hasDeepPage) {
    return "high";
  }
  if (usefulPages.length >= 1 && evidenceCount >= 2) {
    return "medium";
  }
  return "low";
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(`https://${url}`).toString();
  }
}
