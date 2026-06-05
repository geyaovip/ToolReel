export function chunkText(text: string, maxChars = 12): string[] {
  const normalized = text.replace(/\s+/g, "");
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    chunks.push(normalized.slice(index, index + maxChars));
  }
  return chunks.slice(0, 2);
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

