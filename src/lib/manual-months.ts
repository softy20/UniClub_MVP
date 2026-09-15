export type MonthHeadingHit = { month: number; index: number };

const MONTH_HEADING_RE = /(?:^|\n)[ \t#\-]*((?:1[0-2]|[1-9]))\s*월/g;
const MIN_MONTH_HEADINGS = 3;

export function monthHeadingHits(text: string): MonthHeadingHit[] {
  const hits: MonthHeadingHit[] = [];
  for (const match of text.matchAll(MONTH_HEADING_RE)) {
    const month = Number(match[1]);
    if (month >= 1 && month <= 12) {
      hits.push({ month, index: match.index ?? 0 });
    }
  }
  return hits;
}

export function hasMonthSections(text: string): boolean {
  return monthHeadingHits(text).length >= MIN_MONTH_HEADINGS;
}
