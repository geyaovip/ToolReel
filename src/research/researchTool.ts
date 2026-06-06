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
    const links = pickRelevantInternalLinks(homepage, 4);
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
  return {
    toolName: input.name,
    officialUrl,
    summary: summary.summary,
    pricing: summary.pricing,
    targetUsers: summary.targetUsers,
    sellingPoints: summary.sellingPoints,
    positioning: summary.positioning,
    highlights: summary.highlights,
    useCases: summary.useCases,
    evidence: summary.evidence,
    sourcePages: pages.map((page) => ({
      url: page.url,
      title: page.title,
      description: page.description,
      extractedTextLength: page.textBlocks.join("").length,
    })),
    unknowns: summary.unknowns,
    notes,
  };
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
    summary: `${input.name} 的官网暂时无法抓取到足够文本，当前只保留官网素材和基础展示。`,
    pricing: "unknown",
    targetUsers: ["想快速判断工具价值的人"],
    sellingPoints: ["官网素材已采集，详细亮点待补充"],
    positioning: `${input.name} 的详细定位待从官网补充。`,
    highlights: [],
    useCases: [],
    evidence: [],
    sourcePages: [],
    unknowns: ["官网文本抓取失败，不能可靠判断产品亮点、价格或适用人群。"],
    notes,
  };
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(`https://${url}`).toString();
  }
}
