/**
 * 🧭 UniClub - ops.ts
 *
 * "운영(Ops)" 화면에서 쓰는 데이터를 만드는 파일입니다.
 * 행사 카테고리별 색상을 정하고, 담당 역할별로 할 일을 묶고, 각 행사의 체크리스트와 D-Day를 계산합니다.
 *
 * 📌 주요 기능:
 * - 행사 카테고리 이름(예: "MT", "부스", "회의")을 보고 어울리는 색상 팔레트 고르기
 * - 여러 행사에서 등장하는 카테고리 이름 목록을 중복 없이 뽑기
 * - 담당자(role) 별로 항목들을 그룹으로 묶기
 * - D-Day 텍스트("D-3", "D+2") 만들기
 * - 동아리 데이터로부터 운영 화면용 이벤트 목록(체크리스트 포함) 만들기
 *
 * 🔗 사용 예시:
 * ```ts
 * // 운영 화면 컴포넌트에서 이렇게 씁니다
 * import { buildOpsEvents, categoryStyle, groupByRole } from './ops'
 *
 * const opsEvents = buildOpsEvents(clubData, new Date(), doneIdsSet);
 * const style = categoryStyle('부스 운영'); // { label, color, bg }
 * ```
 *
 * 🎯 주요 관리 요소:
 * - CAT_PALETTE: 카테고리 색상 팔레트 배열
 * - CategoryStyle: 카테고리 하나의 색상 정보 타입
 * - categoryStyle(label), uniqueCategoryLabels(events): 카테고리 색상/이름 관련 함수
 * - OpsCheck, OpsEvent: 운영 화면에서 쓰는 체크리스트 항목, 이벤트 타입
 * - groupByRole(items, roster, roleOf): 항목들을 담당자별로 묶는 함수
 * - formatDday(daysLeft): D-Day 문자열을 만드는 함수
 * - buildOpsEvents(data, today, done): 운영 화면에 뿌릴 전체 이벤트 목록을 만드는 함수
 *
 * 💡 팁 및 주의사항:
 * - categoryStyle은 미리 정해진 키워드(정규식)에 안 걸리면, 글자를 숫자로 바꿔서(해시) 팔레트 중 하나를 무작위처럼 고정 배정합니다. 같은 이름은 항상 같은 색이 나옵니다.
 * - buildOpsEvents는 calendar.ts의 buildCalendarEvents와 board.ts의 dayDiff에 의존합니다.
 * - done(Set<string>)에 들어있는 id와 체크리스트 항목 id가 일치해야 완료 표시가 됩니다.
 * - OpsCheck의 daysBefore는 "행사 며칠 전까지 끝내야 하는지"를 나타내는 고정값(저장/수정용)이고,
 *   daysLeft는 오늘 날짜 기준으로 그 마감일까지 실제로 며칠 남았는지를 계산한 값(배지 표시용)입니다.
 *   당일에 하는 할 일(daysBefore=0)이어도 행사일이 먼 미래면 daysLeft는 큰 값이 됩니다.
 *
 * @file ops.ts
 * @module lib/ops
 */

import { buildCalendarEvents } from "./calendar";
import { dayDiff } from "./board";
import type { ClubData } from "./types";

// 업무 종류 카테고리 버튼 템플릿
export const CAT_PALETTE = [
  { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  { color: "#E8492C", bg: "rgba(232,73,44,0.15)" },
  { color: "#00838F", bg: "rgba(0,131,143,0.15)" },
  { color: "#5BA8D4", bg: "rgba(91,168,212,0.15)" },
  { color: "#6A4FE0", bg: "rgba(106,79,224,0.15)" },
  { color: "#8E24AA", bg: "rgba(142,36,170,0.15)" },
  { color: "#D81B7A", bg: "rgba(216,27,122,0.15)" },
  { color: "#1BD87A", bg: "rgba(27, 216, 134, 0.15)" },
  { color: "#67AA24", bg: "rgba(66, 173, 37, 0.15)" },
] as const;

export type CategoryStyle = { label: string; color: string; bg: string };

function paletteIndex(text: string): number {
  if (/MT|엠티|수련회|워크숍|워크샵/i.test(text)) return 6;
  if (/봉사/.test(text)) return 5;
  if (/회의|총회|세미나|스크럼|정기회의/.test(text)) return 4;
  if (/회식|친목|뒤풀이|네트워킹|정기행사/.test(text)) return 3;
  if (/모집|면접|OT|오리엔테이션/.test(text)) return 2;
  if (/부스/.test(text)) return 1;
  if (/투어|해양|현장|답사/.test(text)) return 7;
  if (/공연|해커톤|대회|프로젝트|발표|교육|스터디|선물/.test(text)) return 0;
  if (/정기활동/.test(text)) return 8;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % CAT_PALETTE.length;
}

export function categoryStyle(label: string): CategoryStyle {
  const name = label.trim() || "기타";
  const pal = CAT_PALETTE[paletteIndex(name)];
  return { label: name, color: pal.color, bg: pal.bg };
}

export function uniqueCategoryLabels(events: { category: string }[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const event of events) {
    const name = event.category.trim() || "기타";
    if (seen.has(name)) continue;
    seen.add(name);
    labels.push(name);
  }
  return labels;
}

export type OpsCheck = {
  id: string;
  text: string;
  done: boolean;
  daysBefore: number;
  daysLeft: number;
  role: string;
};

export type OpsEvent = {
  id: string;
  title: string;
  date: Date;
  category: string;
  dday: string;
  daysLeft: number;
  location: string;
  memo: string;
  checklist: OpsCheck[];
  editable: boolean;
};

const COMMON_ROLE = "공통";

export function groupByRole<T>(
  items: T[],
  roster: string[],
  roleOf: (item: T) => string,
): { role: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const role = roleOf(item).trim() || COMMON_ROLE;
    const list = buckets.get(role);
    if (list) list.push(item);
    else buckets.set(role, [item]);
  }
  const order = [...roster];
  for (const role of buckets.keys()) {
    if (!order.includes(role)) order.push(role);
  }
  return order.filter((role) => buckets.has(role)).map((role) => ({ role, items: buckets.get(role)! }));
}

export function formatDday(daysLeft: number): string {
  if (daysLeft > 0) return `D-${daysLeft}`;
  if (daysLeft === 0) return "D-0";
  return `D+${-daysLeft}`;
}

function eventCategoryLabel(sourceCategory: string | undefined, eventId: string): string {
  const fromSource = sourceCategory?.trim();
  if (fromSource) return fromSource;
  if (eventId.startsWith("gift-")) return "선물";
  return "기타";
}

export function buildOpsEvents(data: ClubData, today: Date, done: Set<string>): OpsEvent[] {
  const calendar = buildCalendarEvents(data);
  const byId = new Map(data.events.map((event) => [event.event_id, event]));

  return calendar.map((item) => {
    const source = byId.get(item.id);
    const daysLeft = dayDiff(today, item.date);
    const checklist: OpsCheck[] = (source?.tasks ?? []).map((task, index) => {
      const id = task.task_id ?? `${item.id}-${index}`;
      const dueDate = new Date(
        item.date.getFullYear(),
        item.date.getMonth(),
        item.date.getDate() - task.days_before_dday,
        12,
      );
      return {
        id,
        text: task.task_name,
        done: done.has(id),
        daysBefore: task.days_before_dday,
        daysLeft: dayDiff(today, dueDate),
        role: task.assigned_role.trim() || "공통",
      };
    });

    return {
      id: item.id,
      title: item.name,
      date: item.date,
      category: eventCategoryLabel(source?.category, item.id),
      dday: formatDday(daysLeft),
      daysLeft,
      location: source?.location ?? "",
      memo: item.details,
      checklist,
      editable: Boolean(source),
    };
  });
}
