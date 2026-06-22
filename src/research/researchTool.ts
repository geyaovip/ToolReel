import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComparisonTargetResearch, GenerateInput, ResearchResult, ToolInput } from "../types.ts";
import { extractPage, pickRelevantInternalLinks, type ExtractedPage } from "./pageExtract.ts";
import { summarizePages } from "./summarize.ts";
import { slugify } from "../utils/slug.ts";
import { writeJson } from "../utils/file.ts";

const RESEARCH_CACHE_DIR = join("outputs", "_research-cache");

export async function researchTool(input: GenerateInput): Promise<ResearchResult> {
  const primary = await researchSingleTool(input);
  if (input.type !== "comparison" || !input.compareTargets?.length || !input.url.trim()) {
    return primary;
  }

  const comparisonTargets = await researchComparisonTargets(input, input.compareTargets);
  return {
    ...primary,
    comparisonTargets,
    notes: [
      ...(primary.notes ?? []),
      `Comparison research collected for ${comparisonTargets.length} additional tool(s).`,
    ],
  };
}

async function researchSingleTool(input: GenerateInput): Promise<ResearchResult> {
  if (!input.url.trim()) {
    throw new Error(`Real research requires an official URL for ${input.name}.`);
  }

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
    const cached = await reusableResearch(input, notes);
    if (cached) {
      return cached;
    }
    throw new Error(
      `Real research failed for ${input.name}. No verified page content or reusable verified research was available. ${notes.join(" | ")}`,
    );
  }

  const summary = summarizePages(input.name, pages);
  const confidence = confidenceFor(pages, summary.evidence.length);
  const research = {
    toolName: input.name,
    officialUrl,
    summary: summary.summary,
    pricing: summary.pricing,
    confidence,
    insights: summary.insights,
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
  await cacheResearch(research);
  return research;
}

async function researchComparisonTargets(
  input: GenerateInput,
  targets: ToolInput[],
): Promise<ComparisonTargetResearch[]> {
  const uniqueTargets = targets
    .filter((target) => target.name.trim() && target.url.trim())
    .filter((target, index, array) => {
      const key = `${target.name.trim().toLowerCase()}|${target.url.trim().toLowerCase()}`;
      return (
        array.findIndex((item) => {
          const itemKey = `${item.name.trim().toLowerCase()}|${item.url.trim().toLowerCase()}`;
          return itemKey === key;
        }) === index
      );
    })
    .slice(0, 3);

  const results: ComparisonTargetResearch[] = [];
  for (const target of uniqueTargets) {
    const targetResearch = await researchSingleTool({
      ...input,
      name: target.name,
      url: target.url,
      compareTargets: undefined,
    });
    results.push(toComparisonTargetResearch(targetResearch));
  }
  return results;
}

function toComparisonTargetResearch(research: ResearchResult): ComparisonTargetResearch {
  return {
    toolName: research.toolName,
    officialUrl: research.officialUrl,
    summary: research.summary,
    positioning: research.positioning,
    confidence: research.confidence,
    highlights: (research.highlights ?? []).slice(0, 3),
    useCases: (research.useCases ?? []).slice(0, 3),
    sourcePageCount: research.sourcePages?.length ?? 0,
    evidenceCount: research.evidence?.length ?? 0,
    unknowns: research.unknowns,
  };
}

async function reusableResearch(input: GenerateInput, notes: string[]): Promise<ResearchResult | undefined> {
  const slug = slugify(input.name);
  try {
    const entries = await readdir("outputs", { withFileTypes: true });
    const candidates = [
      join(RESEARCH_CACHE_DIR, `${slug}.json`),
      ...entries
        .filter((entry) => entry.isDirectory() && entry.name.includes(slug) && entry.name !== "_asset-cache")
        .map((entry) => join("outputs", entry.name, "research.json"))
        .sort()
        .reverse(),
    ];

    for (const path of candidates) {
      if (path.startsWith(input.outputDir)) {
        continue;
      }
      try {
        const cached = JSON.parse(await readFile(path, "utf8")) as ResearchResult;
        if (isReusableResearch(cached)) {
          return {
            ...cached,
            notes: [
              ...(cached.notes ?? []),
              ...notes,
              `Reused previous research after live fetch failed: ${path}`,
            ],
          };
        }
      } catch {
        // Try the next previous research artifact.
      }
    }
  } catch {
    // No previous outputs are available yet.
  }
  return undefined;
}

async function cacheResearch(research: ResearchResult): Promise<void> {
  if (!isReusableResearch(research)) {
    return;
  }
  await writeJson(join(RESEARCH_CACHE_DIR, `${slugify(research.toolName)}.json`), {
    ...research,
    notes: [...(research.notes ?? []), "Cached reusable research artifact."],
  });
}

function isReusableResearch(research: ResearchResult): boolean {
  return Boolean(
    research.sourcePages?.length &&
      research.evidence?.length &&
      research.insights?.length &&
      research.confidence &&
      research.confidence !== "low",
  );
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
      notes.push(`Research fetch rejected ${url}: HTTP ${response.status}`);
      return undefined;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      notes.push(`Research fetch rejected ${url}: ${contentType || "non-html response"}`);
      return undefined;
    }
    return extractPage(await response.text(), url);
  } catch (error) {
    notes.push(`Research fetch failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
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
