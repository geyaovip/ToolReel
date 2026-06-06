export function chunkText(text: string, maxChars = 12): string[] {
  return balancedLines(text, maxChars, 2);
}

export function displayLines(text: string, maxChars = 16, maxLines = 2): string[] {
  const normalized = text.replace(/[.…]+$/g, "").replace(/\s+/g, " ").trim();
  if (!normalized || visualLength(normalized) > maxChars * maxLines) {
    return [];
  }

  return balancedLines(normalized, maxChars, maxLines);
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

function balancedLines(text: string, maxChars: number, maxLines: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const tokens = tokenizeText(normalized);
  const lines: string[] = [];
  let current = "";
  let currentLength = 0;

  for (const token of tokens) {
    const tokenLength = visualLength(token);
    if (current && currentLength + tokenLength > maxChars && lines.length < maxLines - 1) {
      lines.push(current.trim());
      current = "";
      currentLength = 0;
    }
    current += token;
    currentLength += tokenLength;
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return rebalanceShortTail(lines.slice(0, maxLines), maxChars);
}

function rebalanceShortTail(lines: string[], maxChars: number): string[] {
  if (lines.length !== 2 || visualLength(lines[1]) >= 4) {
    return lines;
  }

  const combined = `${lines[0]}${lines[1]}`.replace(/\s+/g, " ").trim();
  const target = visualLength(combined) / 2;
  const tokens = tokenizeText(combined);
  let first = "";
  let firstLength = 0;
  let splitIndex = 0;

  for (; splitIndex < tokens.length; splitIndex += 1) {
    const tokenLength = visualLength(tokens[splitIndex]);
    if (first && firstLength + tokenLength > target && firstLength <= maxChars) {
      break;
    }
    first += tokens[splitIndex];
    firstLength += tokenLength;
  }

  const second = tokens.slice(splitIndex).join("").trim();
  return second ? [first.trim(), second] : [combined];
}

function tokenizeText(text: string): string[] {
  return text.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*|\s+|./g) ?? [text];
}

function visualLength(text: string): number {
  let length = 0;
  for (const token of tokenizeText(text)) {
    if (/^\s+$/.test(token)) {
      length += 0.3;
    } else if (/^[A-Za-z0-9._-]+$/.test(token)) {
      length += Math.max(1, token.length * 0.62);
    } else {
      length += 1;
    }
  }
  return length;
}
