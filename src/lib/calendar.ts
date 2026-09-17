/**
 * 🧭 UniClub - calendar.ts
 *
 * 동아리의 행사(events)와 선물/기념일(gifts) 데이터를 달력에 표시할 수 있는 형태로 바꿔주는 파일입니다.
 * 날짜별로 어떤 일정이 있는지, 그 일정이 어떤 종류(다이빙, MT, 부스 등)인지 계산해 줍니다.
 *
 * 📌 주요 기능:
 * - 날짜를 "YYYY-MM-DD" 문자열로 바꾸거나 두 날짜가 같은 날인지 확인
 * - 달력 한 칸(월)에 들어갈 날짜 배열(빈 칸 포함)을 계산
 * - 행사 이름/카테고리 텍스트를 보고 어떤 범례(다이빙, 대면, 임원 등)에 속하는지 분류
 * - 동아리 데이터(ClubData)를 달력에 뿌릴 수 있는 CalendarEvent 배열로 변환
 * - 특정 범례로 필터링했을 때 보여줄 이벤트와 표시할 점(dot) 목록 계산
 *
 * 🔗 사용 예시:
 * ```ts
 * // 달력 컴포넌트에서 이렇게 불러와서 씁니다
 * import { buildCalendarEvents, LEGEND, monthCells, dateKey } from './calendar'
 *
 * const events = buildCalendarEvents(clubData)
 * const cells = monthCells(2025, 3) // 2025년 4월(0부터 시작) 달력 칸 배열
 * ```
 *
 * 🎯 주요 관리 요소:
 * - LEGEND, LegendId: 달력에 쓰이는 범례(태그) 목록과 그 id 타입
 * - CalendarEvent: 달력에 표시할 이벤트 하나의 모양(타입)
 * - dateKey, sameDay, formatPanelDate, monthCells, legendById: 날짜 계산용 함수들
 * - buildCalendarEvents, visibleEvents, dotsForEvents: 이벤트 목록을 만들고 필터링하는 함수들
 * - WEEKDAYS: 요일 이름 배열("일","월",...)
 *
 * 💡 팁 및 주의사항:
 * - EVENT_KINDS는 특정 데모 행사 id에 대한 하드코딩된 매핑이라, 새로운 행사 id는 kindsFromText의 텍스트 규칙으로 분류됩니다.
 * - buildCalendarEvents는 행사와 선물을 합친 뒤 날짜순으로 정렬해서 반환합니다.
 * - legendById는 존재하지 않는 id를 넣으면 에러를 던지니 주의하세요.
 *
 * @file calendar.ts
 * @module lib/calendar
 */

import type { ClubData, ClubEvent, GiftOccasion } from "./types";
import { estimateEventDate, estimateGiftDate } from "./board";

export const LEGEND = [
  { id: "ow", label: "OW", colorClass: "bg-cal-ow" },
  { id: "aow", label: "AOW", colorClass: "bg-cal-aow" },
  { id: "marine", label: "해양", colorClass: "bg-cal-marine" },
  { id: "social", label: "대면", colorClass: "bg-cal-social" },
  { id: "officer", label: "임원", colorClass: "bg-cal-officer" },
  { id: "booth", label: "부스", colorClass: "bg-cal-booth" },
  { id: "mt", label: "MT", colorClass: "bg-cal-mt" },
] as const;

export type LegendId = (typeof LEGEND)[number]["id"];

export type CalendarEvent = {
  id: string;
  name: string;
  date: Date;
  kinds: LegendId[];
  details: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** DESIGN.md 오션홀릭 범례 매핑. 크롬이 아니라 데모 데이터. */
const EVENT_KINDS: Record<string, LegendId[]> = {
  evt_dreamdays_booth: ["booth"],
  evt_recruitment: ["officer"],
  evt_ot_welcome: ["social"],
  evt_check_dive: ["ow"],
  evt_theory: ["ow"],
  evt_pool_ow: ["ow", "aow"],
  evt_summer_mt: ["mt"],
  evt_summer_marine: ["marine"],
  evt_fall_opening: ["social"],
  evt_fall_leisure: ["social", "marine"],
  evt_divers_night: ["social"],
  evt_yearend_election: ["social", "officer"],
  evt_ski_mt: ["mt"],
  evt_club_reregistration: ["officer"],
};

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function formatPanelDate(date: Date, todayYear: number): string {
  const body = `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`;
  if (date.getFullYear() === todayYear) return body;
  return `${date.getFullYear()}년 ${body}`;
}

export function monthCells(year: number, monthIndex: number): (number | null)[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function legendById(id: LegendId) {
  const found = LEGEND.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown legend: ${id}`);
  return found;
}

function kindsForEvent(event: ClubEvent): LegendId[] {
  if (EVENT_KINDS[event.event_id]) return EVENT_KINDS[event.event_id];
  return kindsFromText(`${event.category} ${event.event_name}`);
}

function kindsFromText(text: string): LegendId[] {
  if (/부스|드림데이즈/.test(text)) return ["booth"];
  if (/MT/.test(text)) return ["mt"];
  if (/해양|투어/.test(text)) return ["marine"];
  if (/AOW/.test(text)) return ["aow"];
  if (/OW|이론|스킨|체크 다이빙/.test(text)) return ["ow"];
  if (/모집|면접|재등록|선물|임원/.test(text)) return ["officer"];
  return ["social"];
}

function eventDetails(event: ClubEvent): string {
  const tasks = event.tasks.map((task) => task.task_name).join(" · ");
  return [event.location, tasks].filter(Boolean).join("\n");
}

function giftDetails(gift: GiftOccasion): string {
  return [
    gift.recipients.join(", "),
    [gift.precaution, gift.recommended_items?.length ? `예시: ${gift.recommended_items.join(", ")}` : null]
      .filter(Boolean)
      .join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCalendarEvents(data: ClubData): CalendarEvent[] {
  const year = data.club_info.academic_year;
  const fromEvents = data.events.map((event) => ({
    id: event.event_id,
    name: event.event_name,
    date: estimateEventDate(event, year),
    kinds: kindsForEvent(event),
    details: eventDetails(event),
  }));
  const fromGifts = (data.gifts_and_anniversaries ?? []).map((gift, index) => ({
    id: `gift-${index}`,
    name: gift.occasion,
    date: estimateGiftDate(gift, year),
    kinds: ["officer"] as LegendId[],
    details: giftDetails(gift),
  }));
  return [...fromEvents, ...fromGifts].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function visibleEvents(
  events: CalendarEvent[],
  filter: LegendId | null,
): CalendarEvent[] {
  if (!filter) return events;
  return events.filter((event) => event.kinds.includes(filter));
}

export function dotsForEvents(events: CalendarEvent[], filter: LegendId | null): LegendId[] {
  const visible = visibleEvents(events, filter);
  const present = new Set(visible.flatMap((event) => (filter ? [filter] : event.kinds)));
  return LEGEND.map((item) => item.id).filter((id) => present.has(id));
}

export { WEEKDAYS };
