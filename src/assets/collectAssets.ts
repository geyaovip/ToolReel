import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { captureWebsiteScreenshot } from "./screenshot.ts";
import { downloadAsset } from "./download.ts";
import { extractPageMetadata } from "./html.ts";
import { mergeManualAssets, readManualAssets } from "./manualAssets.ts";
import { extractPage, pickRelevantInternalLinks } from "../research/pageExtract.ts";
import type { AssetCandidate, AssetData, GenerateInput } from "../types.ts";
import { ensureDir } from "../utils/file.ts";

export async function collectAssets(input: GenerateInput): Promise<AssetData> {
  const assetsDir = join(input.outputDir, "assets");
  await ensureDir(assetsDir);

  const notes: string[] = [];
  const manual = await readManualAssets(input.outputDir);
  const existing = await readExistingAssets(input.outputDir);
  const homepageUrl = normalizeUrl(input.url);
  const html = await fetchHomepageHtml(homepageUrl, notes);
  const metadata = html ? extractPageMetadata(html, homepageUrl) : undefined;
  const pageCandidates = html ? buildPageCandidates(html, homepageUrl) : [];
  const linkedPageMetadata = await fetchLinkedPageMetadata(pageCandidates.slice(0, 5), notes);
  const existingScreenshot =
    existingUsablePath(existing?.websiteScreenshot) || existingFile(join(assetsDir, "homepage.png"));
  const screenshotPath =
    (shouldRefreshAssets() || !existingScreenshot
      ? await tryCaptureScreenshot(homepageUrl, join(assetsDir, "homepage.png"), notes, Boolean(existingScreenshot))
      : existingScreenshot) || existingScreenshot;
  const logoPath =
    (await tryDownloadFirst(metadata?.iconUrls ?? [], assetsDir, `${input.name}-logo`, notes)) ||
    existingUsablePath(existing?.logo) ||
    existingFile(join(assetsDir, `${input.name.toLowerCase()}-logo.ico`));

  const logoCandidates: AssetCandidate[] = [
    ...(logoPath
      ? [
          {
            type: "logo" as const,
            path: logoPath,
            label: "Downloaded site icon",
            source: "official_site" as const,
            confidence: "medium" as const,
          },
        ]
      : []),
    ...(metadata?.iconUrls ?? []).map((url) => ({
      type: "logo" as const,
      url,
      label: "Site icon candidate",
      source: "official_site" as const,
      confidence: "medium" as const,
    })),
  ];

  const imageCandidates: AssetCandidate[] = [
    ...(screenshotPath
      ? [
          {
            type: "screenshot" as const,
            path: screenshotPath,
            url: homepageUrl,
            label: "Homepage screenshot",
            source: "official_site" as const,
            confidence: "high" as const,
          },
        ]
      : []),
    ...(metadata?.imageUrls ?? []).map((url) => ({
      type: "image" as const,
      url,
      label: "Homepage image candidate",
      source: "official_site" as const,
      confidence: "medium" as const,
    })),
    ...linkedPageMetadata.flatMap((page) =>
      page.metadata.imageUrls.map((url) => ({
        type: "image" as const,
        url,
        label: `${page.label} image candidate`,
        kind: page.kind,
        source: "official_site" as const,
        confidence: "medium" as const,
      })),
    ),
  ];

  const videoCandidates: AssetCandidate[] = [
    ...(metadata?.videoUrls ?? []).map((url) => ({
      type: "video" as const,
      url,
      label: "Official-site video candidate",
      source: "official_site" as const,
      confidence: "medium" as const,
    })),
    ...linkedPageMetadata.flatMap((page) =>
      page.metadata.videoUrls.map((url) => ({
        type: "video" as const,
        url,
        label: `${page.label} video candidate`,
        kind: page.kind,
        source: "official_site" as const,
        confidence: page.kind === "demo" ? ("high" as const) : ("medium" as const),
      })),
    ),
  ];

  const socialCandidates: AssetCandidate[] = [
    ...(metadata?.socialUrls ?? []).map((url) => ({
      type: "social" as const,
      url,
      label: "Official-site social/video profile",
      source: "official_site" as const,
      confidence: "medium" as const,
    })),
    ...linkedPageMetadata.flatMap((page) =>
      page.metadata.socialUrls.map((url) => ({
        type: "social" as const,
        url,
        label: `${page.label} social/video profile`,
        kind: page.kind,
        source: "official_site" as const,
        confidence: "medium" as const,
      })),
    ),
  ];

  return {
    logo: logoPath ?? logoCandidates[0]?.url ?? "unknown",
    websiteScreenshot: screenshotPath ?? "unknown",
    productScreenshot: screenshotPath ?? "unknown",
    source: screenshotPath || logoPath || metadata ? "auto" : "mock",
    assetsDir,
    homepage: {
      url: homepageUrl,
      title: metadata?.title,
      description: metadata?.description,
      screenshotPath,
    },
    logoCandidates: mergeManualAssets(
      dedupeCandidates(logoCandidates),
      mergeManualAssets(existing?.logoCandidates ?? [], manual?.logoCandidates),
    ),
    imageCandidates: mergeManualAssets(
      dedupeCandidates(imageCandidates),
      mergeManualAssets(existing?.imageCandidates ?? [], manual?.imageCandidates),
    ),
    videoCandidates: mergeManualAssets(
      dedupeCandidates(videoCandidates),
      mergeManualAssets(existing?.videoCandidates ?? [], manual?.videoCandidates),
    ),
    socialCandidates: mergeManualAssets(
      dedupeCandidates(socialCandidates),
      mergeManualAssets(existing?.socialCandidates ?? [], manual?.socialCandidates),
    ),
    pageCandidates: mergeManualAssets(
      dedupeCandidates(pageCandidates),
      mergeManualAssets(existing?.pageCandidates ?? [], manual?.pageCandidates),
    ),
    quoteCandidates: mergeManualAssets(existing?.quoteCandidates ?? [], manual?.quoteCandidates),
    localRecordings: mergeManualAssets(existing?.localRecordings ?? [], manual?.localRecordings),
    notes,
  };
}

function buildPageCandidates(html: string, homepageUrl: string): AssetCandidate[] {
  const homepage = extractPage(html, homepageUrl);
  return pickRelevantInternalLinks(homepage, 10).map((link) => ({
    type: "page" as const,
    url: link.url,
    label: link.text || labelForKind(link.kind),
    kind: link.kind,
    source: "official_site" as const,
    confidence: link.kind && link.kind !== "other" ? ("high" as const) : ("medium" as const),
  }));
}

async function fetchLinkedPageMetadata(
  pages: AssetCandidate[],
  notes: string[],
): Promise<Array<{ label: string; kind: AssetCandidate["kind"]; metadata: NonNullable<ReturnType<typeof extractPageMetadata>> }>> {
  const results: Array<{ label: string; kind: AssetCandidate["kind"]; metadata: ReturnType<typeof extractPageMetadata> }> = [];
  for (const page of pages) {
    if (!page.url) {
      continue;
    }
    const html = await fetchHomepageHtml(page.url, notes);
    if (!html) {
      continue;
    }
    results.push({
      label: page.label ?? labelForKind(page.kind),
      kind: page.kind,
      metadata: extractPageMetadata(html, page.url),
    });
  }
  return results;
}

function labelForKind(kind: AssetCandidate["kind"]): string {
  if (kind === "features") return "Features page";
  if (kind === "docs") return "Docs page";
  if (kind === "demo") return "Demo page";
  if (kind === "use_cases") return "Use cases page";
  if (kind === "customers") return "Customers page";
  if (kind === "enterprise") return "Enterprise page";
  if (kind === "download") return "Download page";
  if (kind === "pricing") return "Pricing page";
  return "Official page";
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(`https://${url}`).toString();
  }
}

async function fetchHomepageHtml(url: string, notes: string[]): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ToolReel/0.1 asset collector",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      notes.push(`Homepage HTML fetch failed: HTTP ${response.status}`);
      return undefined;
    }
    return await response.text();
  } catch (error) {
    notes.push(`Homepage HTML fetch failed: ${messageOf(error)}`);
    return undefined;
  }
}

async function tryCaptureScreenshot(
  url: string,
  outputPath: string,
  notes: string[],
  hasExistingScreenshot: boolean,
): Promise<string | undefined> {
  try {
    return await captureWebsiteScreenshot(url, outputPath);
  } catch (error) {
    notes.push(
      hasExistingScreenshot
        ? `Homepage screenshot refresh skipped after capture error; reused existing screenshot.`
        : `Homepage screenshot failed: ${messageOf(error)}`,
    );
    return undefined;
  }
}

async function tryDownloadFirst(
  urls: string[],
  outputDir: string,
  fallbackName: string,
  notes: string[],
): Promise<string | undefined> {
  for (const url of urls) {
    try {
      return await downloadAsset(url, outputDir, fallbackName);
    } catch (error) {
      notes.push(`Logo candidate skipped (${url}): ${messageOf(error)}`);
    }
  }
  return undefined;
}

function dedupeCandidates(candidates: AssetCandidate[]): AssetCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.path ?? candidate.url ?? candidate.label;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function readExistingAssets(outputDir: string): Promise<AssetData | undefined> {
  try {
    return JSON.parse(await readFile(join(outputDir, "assets.json"), "utf8")) as AssetData;
  } catch {
    return undefined;
  }
}

function existingUsablePath(path: string | undefined): string | undefined {
  if (!path || path === "unknown" || path.startsWith("mock://") || path.startsWith("http")) {
    return undefined;
  }
  return path;
}

function existingFile(path: string): string | undefined {
  return existsSync(path) ? path : undefined;
}

function shouldRefreshAssets(): boolean {
  return process.env.TOOLREEL_REFRESH_ASSETS === "1";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
