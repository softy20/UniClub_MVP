import { buildCalendarEvents, type LegendId } from "./calendar";
import { dayDiff } from "./board";
import type { ClubData } from "./types";

export type FigmaCat = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const CATS: Record<FigmaCat, { label: string; color: string; bg: string }> = {
  1: { label: "OW", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  2: { label: "AOW", color: "#E8492C", bg: "rgba(232,73,44,0.15)" },
  3: { label: "해양", color: "#00838F", bg: "rgba(0,131,143,0.15)" },
  4: { label: "회식", color: "#5BA8D4", bg: "rgba(91,168,212,0.15)" },
  5: { label: "회의", color: "#6A4FE0", bg: "rgba(106,79,224,0.15)" },
  6: { label: "봉사", color: "#8E24AA", bg: "rgba(142,36,170,0.15)" },
  7: { label: "MT", color: "#D81B7A", bg: "rgba(216,27,122,0.15)" },
};

const KIND_TO_CAT: Record<LegendId, FigmaCat> = {
  ow: 1,
  aow: 2,
  marine: 3,
  social: 4,
  officer: 5,
  booth: 6,
  mt: 7,
};

export type OpsCheck = {
  id: string;
  text: string;
  done: boolean;
  daysBefore: number;
};

export type OpsEvent = {
  id: string;
  title: string;
  date: Date;
  category: FigmaCat;
  dday: string;
  daysLeft: number;
  location: string;
  memo: string;
  checklist: OpsCheck[];
};

export function formatDday(daysLeft: number): string {
  if (daysLeft > 0) return `D-${daysLeft}`;
  if (daysLeft === 0) return "D-0";
  return `D+${-daysLeft}`;
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
      };
    });

    return {
      id: item.id,
      title: item.name,
      date: item.date,
      category: KIND_TO_CAT[item.kinds[0] ?? "social"],
      dday: formatDday(daysLeft),
      daysLeft,
      location: source?.location ?? "",
      memo: item.details,
      checklist,
    };
  });
}

export const ALL_CATS = Object.keys(CATS).map(Number) as FigmaCat[];
