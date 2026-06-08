import type { PageCandidateKind } from "../types.ts";

export type ExtractedLink = {
  text: string;
  url: string;
  kind?: PageCandidateKind;
};

export type ExtractedPage = {
  url: string;
  title?: string;
  description?: string;
  textBlocks: string[];
  links: ExtractedLink[];
};

const RELEVANT_LINK_WORDS = [
  "features",
  "product",
  "docs",
  "documentation",
  "guide",
  "learn",
  "customers",
  "case studies",
  "enterprise",
  "use cases",
  "solutions",
  "download",
  "demo",
  "showcase",
  "changelog",
  "pricing",
  "price",
  "plans",
];

export function extractPage(html: string, url: string): ExtractedPage {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "property", "og:description");
  const textBlocks = extractTextBlocks(html);
  const links = extractLinks(html, url);

  return {
    url,
    title,
    description,
    textBlocks,
    links,
  };
}

export function pickRelevantInternalLinks(page: ExtractedPage, limit = 4): ExtractedLink[] {
  const baseHost = new URL(page.url).hostname.replace(/^www\./, "");
  const scored = page.links
    .filter((link) => {
      try {
        const host = new URL(link.url).hostname.replace(/^www\./, "");
        return host === baseHost;
      } catch {
        return false;
      }
    })
    .map((link) => ({ link: { ...link, kind: classifyLink(link) }, score: scoreLink(link) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const picked: ExtractedLink[] = [];
  for (const item of scored) {
    const normalized = item.link.url.replace(/#.*$/, "").replace(/\/$/, "");
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    picked.push(item.link);
    if (picked.length >= limit) {
      break;
    }
  }
  return picked;
}

function scoreLink(link: ExtractedLink): number {
  const haystack = `${link.text} ${link.url}`.toLowerCase();
  const keywordScore = RELEVANT_LINK_WORDS.reduce(
    (score, word) => score + (haystack.includes(word) ? weightForWord(word) : 0),
    0,
  );
  const kind = classifyLink(link);
  return keywordScore + (kind && kind !== "other" ? 2 : 0);
}

export function classifyLink(link: Pick<ExtractedLink, "text" | "url">): PageCandidateKind {
  const haystack = `${link.text} ${link.url}`.toLowerCase();
  if (/pricing|price|plans/.test(haystack)) return "pricing";
  if (/docs|documentation|guide|learn|manual/.test(haystack)) return "docs";
  if (/demo|showcase|video|watch/.test(haystack)) return "demo";
  if (/use-cases|use cases|solutions|workflows?/.test(haystack)) return "use_cases";
  if (/customers?|case-stud|stories/.test(haystack)) return "customers";
  if (/enterprise|security|trust|sso|soc/.test(haystack)) return "enterprise";
  if (/download|install|get started/.test(haystack)) return "download";
  if (/features?|product|platform|agent|composer|tab/.test(haystack)) return "features";
  return "other";
}

function weightForWord(word: string): number {
  if (/docs|documentation|demo|features|product|use cases|solutions/.test(word)) {
    return 4;
  }
  if (/pricing|price|plans/.test(word)) {
    return 1;
  }
  return 2;
}

function extractTextBlocks(html: string): string[] {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  const blocks = [
    ...extractTagText(cleaned, "h1"),
    ...extractTagText(cleaned, "h2"),
    ...extractTagText(cleaned, "h3"),
    ...extractTagText(cleaned, "p"),
    ...extractTagText(cleaned, "li"),
    ...extractTagText(cleaned, "button"),
    ...extractTagText(cleaned, "a"),
  ];

  return unique(
    blocks
      .map(normalizeText)
      .filter((block) => block.length >= 8 && block.length <= 220)
      .filter((block) => !/cookie|privacy policy|terms of service|all rights reserved/i.test(block)),
  ).slice(0, 80);
}

function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const url = resolveUrl(match[1], baseUrl);
    const text = normalizeText(stripTags(match[2]));
    if (url && text.length <= 80) {
      links.push({ text, url, kind: classifyLink({ text, url }) });
    }
  }
  return uniqueBy(links, (link) => `${link.text}:${link.url}`);
}

function extractTagText(html: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    values.push(stripTags(match[1]));
  }
  return values;
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function getMetaContent(html: string, attr: "name" | "property", value: string): string | undefined {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escapeRegex(value)}["'][^>]*>`, "i");
  const tag = html.match(pattern)?.[0];
  return tag ? normalizeText(tag.match(/\bcontent=["']([^"']+)["']/i)?.[1] ?? "") : undefined;
}

function firstMatch(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern)?.[1];
  return match ? normalizeText(stripTags(match)) : undefined;
}

function normalizeText(value: string): string {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?，。；：！？])/g, "$1")
    .trim();
}

function resolveUrl(value: string, baseUrl: string): string | undefined {
  if (!value || value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("javascript:")) {
    return undefined;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], keyOf: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyOf(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
