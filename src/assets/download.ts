import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { ensureDir } from "../utils/file.ts";
import { slugify } from "../utils/slug.ts";

export async function downloadAsset(url: string, outputDir: string, fallbackName: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ToolReel/0.1 asset collector",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`download failed ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image/") && !contentType.includes("svg")) {
    throw new Error(`not an image asset: ${contentType || "unknown content-type"}`);
  }

  await ensureDir(outputDir);
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = extensionFor(url, contentType);
  const outputPath = `${outputDir}/${slugify(fallbackName)}${extension}`;
  await writeFile(outputPath, buffer);
  return outputPath;
}

function extensionFor(url: string, contentType: string): string {
  try {
    const extension = extname(new URL(url).pathname);
    if (extension && extension.length <= 8) {
      return extension;
    }
  } catch {
    // Fall through to content-type based extension.
  }

  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return ".img";
}
