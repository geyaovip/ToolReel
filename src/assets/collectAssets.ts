import { join } from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile } from "node:fs/promises";
import { captureWebsiteScreenshot } from "./screenshot.ts";
import { downloadAsset } from "./download.ts";
import { extractPageMetadata } from "./html.ts";
import { mergeManualAssets, readManualAssets } from "./manualAssets.ts";
import { extractPage, pickRelevantInternalLinks } from "../research/pageExtract.ts";
import { scoreAssets } from "./scoreAssets.ts";
import type { AssetCandidate, AssetData, GenerateInput } from "../types.ts";
import { ensureDir } from "../utils/file.ts";
import { slugify } from "../utils/slug.ts";

export async function collectAssets(input: GenerateInput): Promise<AssetData> {
  const assetsDir = join(input.outputDir, "assets");
  await ensureDir(assetsDir);

  const notes: string[] = [];
  const manual = await readManualAssets(input.outputDir);
  const existing = await readExistingAssets(input.outputDir);
  if (!input.url.trim()) {
    const hasManualOrExistingAssets =
      Boolean(existingUsablePath(existing?.logo) || existingUsablePath(existing?.websiteScreenshot) || existingUsablePath(existing?.productScreenshot)) ||
      manualAssetCount(manual) > 0;
    if (!hasManualOrExistingAssets) {
      throw new Error("Real asset collection requires an official URL or verified manual assets.");
    }
    return scoreAssets({
      logo: existingUsablePath(existing?.logo) ?? "unknown",
      websiteScreenshot: existingUsablePath(existing?.websiteScreenshot) ?? "unknown",
      productScreenshot: existingUsablePath(existing?.productScreenshot) ?? "unknown",
      source: "manual",
      assetsDir,
      logoCandidates: mergeManualAssets(existing?.logoCandidates ?? [], manual?.logoCandidates),
      imageCandidates: mergeManualAssets(existing?.imageCandidates ?? [], manual?.imageCandidates),
      videoCandidates: mergeManualAssets(existing?.videoCandidates ?? [], manual?.videoCandidates),
      socialCandidates: mergeManualAssets(existing?.socialCandidates ?? [], manual?.socialCandidates),
      pageCandidates: mergeManualAssets(existing?.pageCandidates ?? [], manual?.pageCandidates),
      externalCandidates: mergeManualAssets(existing?.externalCandidates ?? [], manual?.externalCandidates),
      quoteCandidates: mergeManualAssets(existing?.quoteCandidates ?? [], manual?.quoteCandidates),
      localRecordings: mergeManualAssets(existing?.localRecordings ?? [], manual?.localRecordings),
      notes: ["No official URL provided; asset collection is limited to manual assets."],
    });
  }
  const homepageUrl = normalizeUrl(input.url);
  const html = await fetchHomepageHtml(homepageUrl, notes);
  if (html && hasCookieOrConsentRisk(html)) {
    notes.push("Homepage may show a cookie, consent, or privacy banner that can obstruct website capture.");
  }
  const metadata = html ? extractPageMetadata(html, homepageUrl) : undefined;
  const pageCandidates = html ? buildPageCandidates(html, homepageUrl) : [];
  const linkedPageMetadata = await fetchLinkedPageMetadata(pageCandidates.slice(0, 5), notes);
  const existingScreenshot =
    existingUsablePath(existing?.websiteScreenshot) ||
    existingFile(join(assetsDir, "homepage.png")) ||
    (await reusableHomepageScreenshot(input.name, notes));
  const screenshotPath =
    (shouldRefreshAssets() || !existingScreenshot
      ? await tryCaptureScreenshot(homepageUrl, join(assetsDir, "homepage.png"), notes, Boolean(existingScreenshot))
      : existingScreenshot) || existingScreenshot;
  if (screenshotPath) {
    await cacheHomepageScreenshot(screenshotPath, assetsDir, notes);
  }
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

  const scoredAssets = scoreAssets({
    logo: logoPath ?? logoCandidates[0]?.url ?? "unknown",
    websiteScreenshot: screenshotPath ?? "unknown",
    productScreenshot: screenshotPath ?? "unknown",
    websiteScrollScreenshot: screenshotPath,
    source: "auto",
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
    externalCandidates: mergeManualAssets(
      dedupeCandidates(buildExternalCandidates(metadata, linkedPageMetadata)),
      mergeManualAssets(existing?.externalCandidates ?? [], manual?.externalCandidates),
    ),
    quoteCandidates: mergeManualAssets(existing?.quoteCandidates ?? [], manual?.quoteCandidates),
    localRecordings: mergeManualAssets(existing?.localRecordings ?? [], manual?.localRecordings),
    notes,
  });

  return await attachSelectedPageScreenshot(scoredAssets, assetsDir, notes);
}

function manualAssetCount(manual: Awaited<ReturnType<typeof readManualAssets>>): number {
  if (!manual) {
    return 0;
  }
  return [
    manual.logoCandidates,
    manual.imageCandidates,
    manual.videoCandidates,
    manual.socialCandidates,
    manual.pageCandidates,
    manual.externalCandidates,
    manual.quoteCandidates,
    manual.localRecordings,
  ].reduce((sum, items) => sum + (items?.length ?? 0), 0);
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
    if (hasCookieOrConsentRisk(html)) {
      notes.push(`${page.label ?? labelForKind(page.kind)} may show a cookie, consent, or privacy banner.`);
    }
    results.push({
      label: page.label ?? labelForKind(page.kind),
      kind: page.kind,
      metadata: extractPageMetadata(html, page.url),
    });
  }
  return results;
}

function hasCookieOrConsentRisk(html: string): boolean {
  return /cookie|consent|privacy preference|privacy settings|accept all|reject all|manage preferences/i.test(html);
}

function buildExternalCandidates(
  metadata: ReturnType<typeof extractPageMetadata> | undefined,
  linkedPageMetadata: Array<{ label: string; kind: AssetCandidate["kind"]; metadata: ReturnType<typeof extractPageMetadata> }>,
): AssetCandidate[] {
  const socialUrls = [
    ...(metadata?.socialUrls ?? []),
    ...linkedPageMetadata.flatMap((page) => page.metadata.socialUrls),
  ];
  const videoUrls = [
    ...(metadata?.videoUrls ?? []),
    ...linkedPageMetadata.flatMap((page) => page.metadata.videoUrls),
  ];

  return [
    ...socialUrls.map((url) => ({
      type: "social" as const,
      url,
      label: externalLabel(url),
      source: "third_party" as const,
      confidence: wasLinkedFromOfficialSite(url) ? ("medium" as const) : ("low" as const),
    })),
    ...videoUrls.map((url) => ({
      type: "video" as const,
      url,
      label: externalLabel(url),
      source: "third_party" as const,
      confidence: wasLinkedFromOfficialSite(url) ? ("medium" as const) : ("low" as const),
    })),
  ];
}

function externalLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/youtube|youtu\.be/.test(host)) return "Official-linked video candidate";
    if (/twitter|x\.com/.test(host)) return "Official-linked social candidate";
    if (/github/.test(host)) return "Official-linked repository candidate";
    return "Official-linked external candidate";
  } catch {
    return "External candidate";
  }
}

function wasLinkedFromOfficialSite(url: string): boolean {
  return /^https?:\/\//i.test(url);
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

async function attachSelectedPageScreenshot(
  assets: AssetData,
  assetsDir: string,
  notes: string[],
): Promise<AssetData> {
  const selected = assets.selectedAssets?.websiteDemoPage;
  if (!selected?.url) {
    return assets;
  }

  const fileName = `selected-${slugify(selected.kind ?? "page")}-${slugify(selected.label ?? "website-demo")}.png`;
  const outputPath = join(assetsDir, fileName);
  const existingPath = existingFile(outputPath);
  const screenshotPath =
    (shouldRefreshAssets() || !existingPath
      ? await tryCaptureScreenshot(selected.url, outputPath, notes, Boolean(existingPath))
      : existingPath) || existingPath;

  if (!screenshotPath) {
    return assets;
  }

  const selectedWithPath = { ...selected, path: screenshotPath };
  return {
    ...assets,
    productScreenshot: screenshotPath,
    selectedAssets: {
      ...assets.selectedAssets,
      websiteDemoPage: selectedWithPath,
    },
    imageCandidates: dedupeCandidates([
      {
        type: "screenshot",
        path: screenshotPath,
        label: `${selected.label ?? labelForKind(selected.kind)} screenshot`,
        kind: selected.kind,
        source: "official_site",
        confidence: "high",
      },
      ...(assets.imageCandidates ?? []),
    ]),
  };
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
        ? `Homepage screenshot refresh failed; reused an existing real screenshot.`
        : `Homepage screenshot failed: ${messageOf(error)}`,
    );
    return undefined;
  }
}

async function tryDownloadFirst(
  urls: string[],
  outputDir: string,
  defaultName: string,
  notes: string[],
): Promise<string | undefined> {
  for (const url of urls) {
    try {
      return await downloadAsset(url, outputDir, defaultName);
    } catch (error) {
      notes.push(`Logo candidate rejected (${url}): ${messageOf(error)}`);
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
  if (!path || path === "unknown" || path.startsWith("http")) {
    return undefined;
  }
  return path;
}

function existingFile(path: string): string | undefined {
  return existsSync(path) ? path : undefined;
}

async function reusableHomepageScreenshot(toolName: string, notes: string[]): Promise<string | undefined> {
  const slug = slugify(toolName);
  const cachePath = existingFile(join("outputs", "_asset-cache", slug, "homepage.png"));
  if (cachePath) {
    notes.push(`Reused cached homepage screenshot: ${cachePath}`);
    return cachePath;
  }

  try {
    const entries = await readdir("outputs", { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isDirectory() && entry.name.includes(slug) && entry.name !== "_asset-cache")
      .map((entry) => join("outputs", entry.name, "assets", "homepage.png"))
      .filter((path) => existsSync(path))
      .sort()
      .reverse();
    if (candidates[0]) {
      notes.push(`Reused previous homepage screenshot: ${candidates[0]}`);
      return candidates[0];
    }
  } catch {
    // No previous outputs are available yet.
  }

  return undefined;
}

async function cacheHomepageScreenshot(path: string, assetsDir: string, notes: string[]): Promise<void> {
  try {
    const toolSlug = assetsDir.split("/").at(-2)?.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-(tutorial|comparison|top-list|website-demo|news|update-news)$/, "");
    if (!toolSlug || path.includes("_asset-cache")) {
      return;
    }
    const cacheDir = join("outputs", "_asset-cache", toolSlug);
    await ensureDir(cacheDir);
    await copyFile(path, join(cacheDir, "homepage.png"));
  } catch (error) {
    notes.push(`Homepage screenshot cache write failed: ${messageOf(error)}`);
  }
}

function shouldRefreshAssets(): boolean {
  return process.env.TOOLREEL_REFRESH_ASSETS === "1";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
