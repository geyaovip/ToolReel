import type { AssetData, OutputValidationCheck } from "../types.ts";

export function validateAssetsForMvp(assets: AssetData): OutputValidationCheck[] {
  const websiteDemoVisual =
    usableLocalAsset(assets.selectedAssets?.websiteDemoPage?.path) ??
    usableLocalAsset(assets.productScreenshot) ??
    usableLocalAsset(assets.websiteScreenshot);
  const hasWebsiteVisual = Boolean(websiteDemoVisual);

  return [
    {
      name: "websiteVisualAssetAvailable",
      passed: hasWebsiteVisual,
      actual: websiteDemoVisual ?? "missing",
      expected: "usable selected page, product, or homepage screenshot for website demo",
    },
  ];
}

function usableLocalAsset(path: string | undefined): string | undefined {
  return path && path !== "unknown" && !path.startsWith("mock://") && !path.startsWith("http")
    ? path
    : undefined;
}
