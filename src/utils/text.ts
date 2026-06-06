export function chunkText(text: string, maxChars = 12): string[] {
  const normalized = text.replace(/\s+/g, "");
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    chunks.push(normalized.slice(index, index + maxChars));
  }
  return chunks.slice(0, 2);
}

export function displayLines(text: string, maxChars = 16, maxLines = 2): string[] {
  const normalized = text.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxChars * maxLines) {
    return [];
  }

  const lines: string[] = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    lines.push(normalized.slice(index, index + maxChars));
  }
  return lines.slice(0, maxLines);
}

export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function sceneFileName(index: number, id: string): string {
  return `${String(index).padStart(2, "0")}-${id}.mp4`;
}
