/**
 * 🧭 UniClub - board.ts
 *
 * "이번 주 할 일 보드" 화면에 필요한 데이터를 계산하는 파일입니다.
 * 동아리 행사와 선물 일정에서 할 일(task)을 뽑아내고, 이번 주/다음 주에 해야 할 일과 마감일(D-Day)을 정리합니다.
 *
 * 📌 주요 기능:
 * - 행사 날짜, 선물 날짜를 문자열/요일 정보로부터 실제 Date로 추정 계산
 * - 행사와 선물 데이터를 할 일(BoardTask) 목록으로 펼치기(flatten)
 * - 이번 주, 다음 주에 해야 할 일을 마감일 기준으로 골라서 정렬
 * - 가장 가까운 다가오는 행사(upcoming event) 찾기
 * - 날짜를 "3월 4일 화" 같은 한국어 문자열로 포맷
 * - D-Day 텍스트("D-3", "오늘", "지연 2일" 등) 계산
 * - 완료한 할 일 id 목록을 동아리+학년도별로 브라우저 localStorage에 저장/불러오기
 *
 * 🔗 사용 예시:
 * ```ts
 * // 보드 화면 컴포넌트에서 이렇게 씁니다
 * import { buildBoard, taskDdayLabel, loadDoneIds, saveDoneIds } from './board'
 *
 * const board = buildBoard(clubData); // { thisWeek, nextWeek, upcoming, ... }
 * const label = taskDdayLabel(task.dueDate); // { text: "D-2", tone: "soon" }
 * ```
 *
 * 🎯 주요 관리 요소:
 * - dayDiff, toDateInputValue, estimateEventDate, estimateGiftDate: 날짜 계산 함수들
 * - buildBoard(data, today?): 이번 주/다음 주 할 일과 다가오는 행사를 묶어서 반환
 * - formatDate, formatRange, taskDdayLabel: 화면에 보여줄 문자열을 만드는 함수들
 * - loadDoneIds(clubId, academicYear), saveDoneIds(clubId, academicYear, ids): 완료 체크 상태를
 *   동아리+학년도별로 나눠서 브라우저에 저장하는 함수들 (키: "uniclub-done-v1:{clubId}:{academicYear}")
 *
 * 💡 팁 및 주의사항:
 * - loadDoneIds/saveDoneIds는 브라우저의 localStorage를 직접 건드리는 부수효과(side effect)가 있습니다. 서버 환경(SSR)에서는 쓸 수 없습니다.
 * - 완료 체크를 동아리+학년도별로 나누는 이유: 동아리를 바꾸거나 시즌을 전환해도 다른 동아리/해의 체크가 섞여 보이면 안 되기 때문입니다.
 * - 날짜 계산은 항상 정오(12시) 기준으로 맞춰서(atNoon), 시간대 차이로 날짜가 하루씩 밀리는 문제를 방지합니다.
 * - buildBoard의 today 기본값은 한국 시간(KST) 기준 오늘 날짜(readKst().civil)입니다.
 *
 * @file board.ts
 * @module lib/board
 */

import type { BoardTask, ClubData, ClubEvent, GiftOccasion, UpcomingEvent } from "./types";
import { readKst } from "./kst";

const CHUSEOK_2026 = new Date(2026, 8, 25);

function atNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date: Date, days: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 주어진 날짜가 속한 주의 월요일(정오)을 구한다.
 * 특이사항: 일요일(getDay()===0)은 그 주의 마지막 날로 취급해 -6일을 적용한다.
 */
function startOfWeek(date: Date): Date {
  const d = atNoon(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

/**
 * 두 날짜 사이의 일수 차이를 계산한다(to - from).
 * @returns to가 from보다 미래면 양수, 과거면 음수
 * 특이사항: 두 날짜 모두 정오로 맞춘 뒤 계산해서 시:분:초 차이로 반올림이 어긋나지 않게 한다.
 */
export function dayDiff(from: Date, to: Date): number {
  const ms = atNoon(to).getTime() - atNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * "1주", "둘째", "말" 같은 주차 표현을 그 달의 대표 일자(day)로 변환한다.
 * @returns 알 수 없는 표현이거나 값이 없으면 15일(그 달 중순)을 기본값으로 반환
 */
function dayFromWeekLabel(week?: string): number {
  if (!week) return 15;
  if (week.includes("1주") || week.includes("첫째")) return 5;
  if (week.includes("2주") || week.includes("둘째")) return 12;
  if (week.includes("3주") || week.includes("셋째")) return 19;
  if (week.includes("4주") || week.includes("말") || week.includes("마지막")) return 26;
  if (week.includes("2월 말")) return 28;
  return 15;
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

/**
 * 학년도(academicYear) 기준으로 해당 월이 실제 달력상 몇 년도에 해당하는지 계산한다.
 * 특이사항: 학년도는 보통 3월에 시작하므로, 1~2월은 다음 해로 넘어간 시점으로 보고 academicYear + 1을 반환한다.
 */
function calendarYearForMonth(academicYear: number, month: number): number {
  return month <= 2 ? academicYear + 1 : academicYear;
}

/**
 * 행사 날짜 문자열(ISO 형식, "N월 N일" 형식, 그 외 임의 형식)을 Date로 파싱한다.
 * @param fallbackYear - 문자열에 연도가 없을 때 사용할 연도
 * @returns 파싱에 실패하면 null
 */
function parseEventDate(value: string, fallbackYear: number): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(trimmed);
  if (iso) {
    const date = atNoon(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isValidDate(date) ? date : null;
  }

  const korean = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(trimmed);
  if (korean) {
    const year = korean[1] ? Number(korean[1]) : fallbackYear;
    const date = atNoon(new Date(year, Number(korean[2]) - 1, Number(korean[3])));
    return isValidDate(date) ? date : null;
  }

  const parsed = new Date(trimmed);
  if (!isValidDate(parsed)) return null;
  return atNoon(parsed);
}

/**
 * Date를 `<input type="date">`가 요구하는 "YYYY-MM-DD" 문자열로 변환한다.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 행사의 실제 날짜를 추정한다. event_date 문자열이 있으면 우선 파싱하고, 없거나 파싱에 실패하면
 * target_month/target_week로부터 대략적인 날짜를 계산한다.
 * 특이사항: 파싱된 연도가 academicYear보다 이르면(예: 이전 시즌 데이터 재사용) 현재 학년도 기준으로 연도를 다시 맞춘다.
 */
export function estimateEventDate(event: ClubEvent, academicYear: number): Date {
  const month = event.target_month >= 1 && event.target_month <= 12 ? event.target_month : 3;
  const fallbackYear = calendarYearForMonth(academicYear, month);
  const fallback = atNoon(new Date(fallbackYear, month - 1, dayFromWeekLabel(event.target_week)));
  if (!event.event_date) return fallback;

  const parsed = parseEventDate(event.event_date, fallbackYear);
  if (!parsed) return fallback;
  if (parsed.getFullYear() < academicYear) {
    const parsedMonth = parsed.getMonth() + 1;
    return atNoon(new Date(calendarYearForMonth(academicYear, parsedMonth), parsed.getMonth(), parsed.getDate()));
  }
  return parsed;
}

/**
 * 선물/기념일의 실제 날짜를 추정한다.
 * 특이사항: "추석"이 포함된 항목은 2026년 추석(CHUSEOK_2026)으로 고정 처리하고, 나머지는 target_month의 20일로 어림잡는다.
 */
export function estimateGiftDate(gift: GiftOccasion, academicYear: number): Date {
  if (gift.occasion.includes("추석")) return atNoon(CHUSEOK_2026);
  const month = gift.target_month >= 1 && gift.target_month <= 12 ? gift.target_month : 3;
  return atNoon(new Date(calendarYearForMonth(academicYear, month), month - 1, 20));
}

/**
 * 동아리의 행사별 할 일과 선물 준비를 하나의 BoardTask 배열로 펼친다.
 * 특이사항: 선물 준비는 항상 마감 14일 전(daysBefore=14)으로 고정하고, 담당자는 "총무"로 지정한다.
 */
function flattenTasks(data: ClubData): BoardTask[] {
  const year = data.club_info.academic_year;
  const fromEvents = data.events.flatMap((event) => {
    const eventDate = estimateEventDate(event, year);
    return event.tasks.map((task, index) => {
      const dueDate = addDays(eventDate, -task.days_before_dday);
      return {
        id: task.task_id ?? `${event.event_id}-${index}`,
        name: task.task_name,
        eventName: event.event_name,
        eventId: event.event_id,
        eventDate,
        dueDate,
        daysBefore: task.days_before_dday,
        role: task.assigned_role,
        mandatory: task.is_mandatory,
        details: task.action_details,
        checklist: task.checklist ?? [],
      };
    });
  });

  const fromGifts = (data.gifts_and_anniversaries ?? []).map((gift, index) => {
    const eventDate = estimateGiftDate(gift, year);
    const dueDate = addDays(eventDate, -14);
    return {
      id: `gift-${index}`,
      name: `${gift.occasion} 준비`,
      eventName: gift.occasion,
      eventId: `gift-${index}`,
      eventDate,
      dueDate,
      daysBefore: 14,
      role: "총무",
      mandatory: true,
      details: [
        gift.recipients.join(", "),
        [
          gift.precaution,
          gift.recommended_items?.length ? `예시: ${gift.recommended_items.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ]
        .filter(Boolean)
        .join("\n· "),
      checklist: [],
    };
  });

  return [...fromEvents, ...fromGifts];
}

/**
 * 이번 주/다음 주 할 일 목록과 가장 가까운 다가오는 행사를 계산해서 보드 화면용 데이터로 묶는다.
 * @param today - 기준 날짜(기본값: KST 기준 오늘)
 * @returns thisWeek, nextWeek(마감일 오름차순 정렬), upcoming, 그리고 각 주의 시작/끝 날짜
 * 특이사항: 이번 주가 지났는데도 아직 안 끝난 최근 지연 할 일(overdueRecent, 14일 이내 & 행사가 아직 안 지남)은 이번 주 목록에 포함시킨다.
 */
export function buildBoard(data: ClubData, today: Date = readKst().civil) {
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const nextStart = addDays(weekEnd, 1);
  const nextEnd = addDays(nextStart, 6);
  const all = flattenTasks(data);

  const inRange = (due: Date, start: Date, end: Date) => {
    const t = atNoon(due).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const overdueRecent = (task: BoardTask) => {
    const lateBy = dayDiff(task.dueDate, today);
    return lateBy > 0 && lateBy <= 14 && task.eventDate >= atNoon(today);
  };

  const sortTasks = (a: BoardTask, b: BoardTask) => a.dueDate.getTime() - b.dueDate.getTime();

  const thisWeek = all
    .filter((task) => inRange(task.dueDate, weekStart, weekEnd) || overdueRecent(task))
    .sort(sortTasks);

  const thisWeekIds = new Set(thisWeek.map((task) => task.id));
  const nextWeek = all
    .filter((task) => inRange(task.dueDate, nextStart, nextEnd) && !thisWeekIds.has(task.id))
    .sort(sortTasks);

  const upcoming = nearestEvent(data, today);

  return { thisWeek, nextWeek, upcoming, weekStart, weekEnd, nextStart, nextEnd };
}

/**
 * 오늘 이후로 예정된 행사 중 가장 가까운 행사를 찾는다.
 * @returns 다가오는 행사가 없으면 null
 */
function nearestEvent(data: ClubData, today: Date): UpcomingEvent | null {
  const year = data.club_info.academic_year;
  const candidates = data.events
    .map((event) => {
      const eventDate = estimateEventDate(event, year);
      return {
        eventId: event.event_id,
        eventName: event.event_name,
        eventDate,
        daysLeft: dayDiff(today, eventDate),
        location: event.location,
      };
    })
    .filter((event) => event.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return candidates[0] ?? null;
}

/**
 * 날짜를 "3월 4일 화" 형태의 한국어 문자열로 포맷한다.
 */
export function formatDate(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}`;
}

/**
 * 두 날짜를 "3/4–3/10" 형태의 짧은 범위 문자열로 포맷한다.
 */
export function formatRange(start: Date, end: Date): string {
  return `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
}

/**
 * 마감일까지 남은 일수를 화면에 보여줄 D-Day 텍스트와 색조(tone)로 변환한다.
 * @returns 지났으면 "지연 N일"(tone: late), 오늘이면 "오늘"(tone: today),
 *   3일 이내면 "D-N"(tone: soon), 그 외엔 "D-N"(tone: later)
 */
export function taskDdayLabel(dueDate: Date, today: Date = readKst().civil): { text: string; tone: "late" | "today" | "soon" | "later" } {
  const days = dayDiff(today, dueDate);
  if (days < 0) return { text: `지연 ${Math.abs(days)}일`, tone: "late" };
  if (days === 0) return { text: "오늘", tone: "today" };
  if (days <= 3) return { text: `D-${days}`, tone: "soon" };
  return { text: `D-${days}`, tone: "later" };
}

const STORAGE_KEY_PREFIX = "uniclub-done-v1";

// 완료 체크는 동아리 + 학년도(시즌)별로 따로 저장한다. clubId를 넘겨받지 않으면 다른
// 동아리의 체크가 섞이고, 학년도를 넘겨받지 않으면 다른 해의 체크가 새 시즌으로
// 잘못 넘어오는 문제가 생긴다.
/**
 * 완료 처리된 할 일 id 목록을 동아리+학년도별로 localStorage에서 불러온다.
 * @returns 저장된 값이 없거나 파싱에 실패하면 빈 Set
 */
export function loadDoneIds(clubId: string, academicYear: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${clubId}:${academicYear}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * 완료 처리된 할 일 id 목록을 동아리+학년도별로 localStorage에 저장한다.
 */
export function saveDoneIds(clubId: string, academicYear: number, ids: Set<string>): void {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}:${clubId}:${academicYear}`, JSON.stringify([...ids]));
}
