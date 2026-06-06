export type PageMetadata = {
  title?: string;
  description?: string;
  iconUrls: string[];
  imageUrls: string[];
  videoUrls: string[];
  socialUrls: string[];
};

const SOCIAL_HOSTS = [
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "linkedin.com",
  "tiktok.com",
  "bilibili.com",
];

export function extractPageMetadata(html: string, baseUrl: string): PageMetadata {
  const title = getTitle(html);
  const description =
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "property", "og:description") ||
    getMetaContent(html, "name", "twitter:description");

  const iconUrls = [
    ...getLinkHrefs(html, ["icon", "shortcut icon", "apple-touch-icon", "mask-icon"]),
    getMetaContent(html, "property", "og:logo"),
  ];

  const imageUrls = [
    getMetaContent(html, "property", "og:image"),
    getMetaContent(html, "name", "twitter:image"),
    ...getImageSrcs(html),
  ];

  const videoUrls = [
    getMetaContent(html, "property", "og:video"),
    getMetaContent(html, "property", "og:video:url"),
    getMetaContent(html, "property", "og:video:secure_url"),
    getMetaContent(html, "name", "twitter:player"),
    ...getVideoSrcs(html),
    ...getIframeSrcs(html).filter(isVideoUrl),
    ...getAnchorHrefs(html).filter(isVideoUrl),
  ];

  const socialUrls = getAnchorHrefs(html).filter(isSocialUrl);

  return {
    title,
    description,
    iconUrls: uniqueResolved(iconUrls, baseUrl),
    imageUrls: uniqueResolved(imageUrls, baseUrl).slice(0, 12),
    videoUrls: uniqueResolved(videoUrls, baseUrl).slice(0, 12),
    socialUrls: uniqueResolved(socialUrls, baseUrl).slice(0, 12),
  };
}

function getTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]).trim() : undefined;
}

function getMetaContent(html: string, attr: "name" | "property", value: string): string | undefined {
  const tagPattern = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escapeRegex(value)}["'][^>]*>`, "i");
  const tag = html.match(tagPattern)?.[0];
  return tag ? getAttribute(tag, "content") : undefined;
}

function getLinkHrefs(html: string, rels: string[]): string[] {
  return getTags(html, "link")
    .filter((tag) => {
      const rel = getAttribute(tag, "rel")?.toLowerCase();
      return rel ? rels.some((candidate) => rel.includes(candidate)) : false;
    })
    .map((tag) => getAttribute(tag, "href"))
    .filter(isPresent);
}

function getImageSrcs(html: string): string[] {
  return getTags(html, "img")
    .flatMap((tag) => [getAttribute(tag, "src"), getAttribute(tag, "data-src")])
    .filter(isPresent);
}

function getVideoSrcs(html: string): string[] {
  return [
    ...getTags(html, "video").flatMap((tag) => [getAttribute(tag, "src"), getAttribute(tag, "poster")]),
    ...getTags(html, "source").map((tag) => getAttribute(tag, "src")),
  ].filter(isPresent);
}

function getIframeSrcs(html: string): string[] {
  return getTags(html, "iframe")
    .map((tag) => getAttribute(tag, "src"))
    .filter(isPresent);
}

function getAnchorHrefs(html: string): string[] {
  return getTags(html, "a")
    .map((tag) => getAttribute(tag, "href"))
    .filter(isPresent);
}

function getTags(html: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.match(pattern) ?? [];
}

function getAttribute(tag: string, attr: string): string | undefined {
  const pattern = new RegExp(`\\b${attr}=["']([^"']+)["']`, "i");
  return decodeHtml(tag.match(pattern)?.[1] ?? "").trim() || undefined;
}

function uniqueResolved(values: Array<string | undefined>, baseUrl: string): string[] {
  const resolved = values
    .filter(isPresent)
    .map((value) => resolveUrl(value, baseUrl))
    .filter(isPresent);
  return [...new Set(resolved)];
}

function resolveUrl(value: string, baseUrl: string): string | undefined {
  if (value.startsWith("data:")) {
    return undefined;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function isVideoUrl(value: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|bilibili\.com|\.mp4(\?|$)|\.webm(\?|$)|\.mov(\?|$)/i.test(value);
}

function isSocialUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return SOCIAL_HOSTS.some((socialHost) => host === socialHost || host.endsWith(`.${socialHost}`));
  } catch {
    return false;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}
