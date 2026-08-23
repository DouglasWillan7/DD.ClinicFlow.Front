import type { ReactNode } from "react";
import type { ImportantPointEvidence } from "./importantPoints";

export interface EvidenceRange {
  start: number;
  end: number;
}

export function mergeEvidenceRanges(
  text: string,
  evidence: readonly Pick<ImportantPointEvidence, "quote" | "quoteStart" | "quoteLength">[],
): EvidenceRange[] {
  if (text.length === 0 || evidence.length === 0) return [];

  const validRanges = evidence.flatMap((item) => {
    if (!Number.isInteger(item.quoteStart) ||
      !Number.isInteger(item.quoteLength) ||
      item.quoteStart < 0 ||
      item.quoteLength <= 0) return [];

    const end = item.quoteStart + item.quoteLength;
    if (end > text.length || text.slice(item.quoteStart, end) !== item.quote) return [];
    return [{ start: item.quoteStart, end }];
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: EvidenceRange[] = [];
  for (const range of validRanges) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

export function renderTranscriptText(
  text: string,
  ranges: readonly EvidenceRange[],
): ReactNode {
  if (ranges.length === 0) return text;

  const content: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor || range.start < 0 || range.end <= range.start || range.end > text.length) {
      continue;
    }
    if (range.start > cursor) content.push(text.slice(cursor, range.start));
    content.push(<mark key={`${range.start}:${range.end}`}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  if (cursor < text.length) content.push(text.slice(cursor));
  return content;
}

export function selectFirstEvidence(
  evidence: readonly ImportantPointEvidence[],
): ImportantPointEvidence | null {
  return evidence[0] ?? null;
}
