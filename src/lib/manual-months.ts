/**
 * 🧭 UniClub - manual-months.ts
 *
 * 업로드한 매뉴얼 텍스트 안에 "3월", "4월"처럼 월(month)을 나타내는 제목이 몇 번이나 나오는지 찾아주는 파일입니다.
 * 이 정보로 매뉴얼이 "월별 일정표" 형식인지 아닌지를 판단합니다.
 *
 * 📌 주요 기능:
 * - 텍스트에서 "N월" 형태의 제목(문단 시작 부분)을 정규식으로 찾기
 * - 찾은 월과 텍스트 내 위치(index)를 목록으로 반환
 * - 월 제목이 일정 개수(3개) 이상 있으면 "월별로 나뉜 문서"라고 판단
 *
 * 🔗 사용 예시:
 * ```ts
 * // 매뉴얼 업로드 후 형식을 검사할 때 이렇게 씁니다
 * import { hasMonthSections, monthHeadingHits } from './manual-months'
 *
 * if (hasMonthSections(manualText)) {
 *   console.log('월별 일정 문서로 보입니다');
 * }
 * const hits = monthHeadingHits(manualText); // [{ month: 3, index: 12 }, ...]
 * ```
 *
 * 🎯 주요 관리 요소:
 * - MonthHeadingHit: 찾은 월 제목 하나의 정보(월 번호, 텍스트 위치) 타입
 * - monthHeadingHits(text): 텍스트에서 월 제목들을 찾아 배열로 반환하는 함수
 * - hasMonthSections(text): 월 제목이 충분히(3개 이상) 있는지 true/false로 알려주는 함수
 *
 * 💡 팁 및 주의사항:
 * - MIN_MONTH_HEADINGS(현재 3)보다 적게 월 제목이 나오면 "월별 문서 아님"으로 판단됩니다. 기준을 바꾸려면 이 상수를 수정하세요.
 * - 정규식은 줄바꿈이나 "#", "-" 같은 마크다운 기호로 시작하는 제목도 인식합니다.
 *
 * @file manual-months.ts
 * @module lib/manual-months
 */

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
