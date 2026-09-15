import { buildCalendarEvents } from "./calendar";
import { dayDiff } from "./board";
import type { ClubData } from "./types";

export const CAT_PALETTE = [
  { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  { color: "#E8492C", bg: "rgba(232,73,44,0.15)" },
  { color: "#00838F", bg: "rgba(0,131,143,0.15)" },
  { color: "#5BA8D4", bg: "rgba(91,168,212,0.15)" },
  { color: "#6A4FE0", bg: "rgba(106,79,224,0.15)" },
  { color: "#8E24AA", bg: "rgba(142,36,170,0.15)" },
  { color: "#D81B7A", bg: "rgba(216,27,122,0.15)" },
] as const;

export type CategoryStyle = { label: string; color: string; bg: string };

function paletteIndex(text: string): number {
  if (/MT|엠티|수련회|워크숍|워크샵/i.test(text)) return 6;
  if (/봉사/.test(text)) return 5;
  if (/회의|총회|세미나|스크럼|정기회의/.test(text)) return 4;
  if (/회식|친목|뒤풀이|네트워킹/.test(text)) return 3;
  if (/모집|면접|부스|OT|오리엔테이션/.test(text)) return 2;
  if (/투어|해양|현장|답사/.test(text)) return 2;
  if (/공연|해커톤|대회|프로젝트|발표|교육|스터디/.test(text)) return 0;
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
      return {
        id,
        text: task.task_name,
        done: done.has(id),
        daysBefore: task.days_before_dday,
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
