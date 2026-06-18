import type { AssetData, OutputValidationCheck } from "../types.ts";

export function validateAssetsForMvp(assets: AssetData): OutputValidationCheck[] {
  const websiteDemoVisual =
    usableLocalAsset(assets.selectedAssets?.websiteDemoPage?.path) ??
    usableLocalAsset(assets.productScreenshot) ??
    usableLocalAsset(assets.websiteScreenshot);
  const hasWebsiteVisual = Boolean(websiteDemoVisual);
  const requiresAutoAssetCoverage = assets.source === "auto";
  const hasReusableVisual = hasWebsiteVisual && Boolean(assets.notes?.some((note) => /Reused (cached|previous)/i.test(note)));
  const hasWebsitePageCandidate = Boolean(assets.selectedAssets?.websiteDemoPage || assets.pageCandidates?.length);
  const candidateTypes = new Set([
    ...(assets.pageCandidates ?? []).map((item) => item.type),
    ...(assets.imageCandidates ?? []).map((item) => item.type),
    ...(assets.videoCandidates ?? []).map((item) => item.type),
    ...(assets.socialCandidates ?? []).map((item) => item.type),
    ...(assets.externalCandidates ?? []).map((item) => item.type),
    ...(assets.localRecordings ?? []).map((item) => item.type),
  ]);

  return [
    {
      name: "websiteVisualAssetAvailable",
      passed: !requiresAutoAssetCoverage || hasWebsiteVisual || hasWebsitePageCandidate,
      actual: websiteDemoVisual ?? "missing",
      expected: requiresAutoAssetCoverage
        ? "usable visual asset, or a selected page candidate that can be skipped if screenshot capture fails"
        : "manual/topic mode can defer website visual assets",
    },
    {
      name: "assetCandidateTypesPresent",
      passed: !requiresAutoAssetCoverage || hasReusableVisual || candidateTypes.size >= 2,
      actual: [...candidateTypes].join(", ") || "none",
      expected: requiresAutoAssetCoverage
        ? "at least two asset candidate types, or reusable cached visual when live fetch is unavailable"
        : "manual/topic mode can defer asset candidates",
    },
    {
      name: "assetSelectionRecorded",
      passed:
        !requiresAutoAssetCoverage ||
        hasReusableVisual ||
        Boolean(assets.selectedAssets?.websiteDemoPage || assets.selectedAssets?.featurePage || assets.selectedAssets?.workflowPage),
      actual: Object.keys(assets.selectedAssets ?? {}).join(", ") || "none",
      expected: requiresAutoAssetCoverage ? "selected website, feature, workflow asset, or reusable cached visual" : "manual/topic mode can defer selected assets",
    },
  ];
}

function usableLocalAsset(path: string | undefined): string | undefined {
  return path && path !== "unknown" && !path.startsWith("mock://") && !path.startsWith("http")
    ? path
    : undefined;
}
