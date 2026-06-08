import type { AssetData, OutputValidationCheck } from "../types.ts";

export function validateAssetsForMvp(assets: AssetData): OutputValidationCheck[] {
  const hasWebsiteVisual = isUsableLocalAsset(assets.websiteScreenshot) || isUsableLocalAsset(assets.productScreenshot);

  return [
    {
      name: "websiteVisualAssetAvailable",
      passed: hasWebsiteVisual,
      actual: hasWebsiteVisual ? assets.websiteScreenshot || assets.productScreenshot : "missing",
      expected: "usable homepage or product screenshot for website demo",
    },
  ];
}

function isUsableLocalAsset(path: string | undefined): boolean {
  return Boolean(path && path !== "unknown" && !path.startsWith("mock://") && !path.startsWith("http"));
}
