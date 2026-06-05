import type { AssetData, GenerateInput } from "../types.ts";

export async function collectAssets(input: GenerateInput): Promise<AssetData> {
  return {
    logo: `mock://${input.name}/logo`,
    websiteScreenshot: `mock://${input.url}/homepage-screenshot`,
    productScreenshot: `mock://${input.name}/product-screenshot`,
    source: "mock",
  };
}

