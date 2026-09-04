import type { BoardTask, ClubData, ClubEvent, GiftOccasion, UpcomingEvent } from "./types";

/** Demo clock for 2026 academic-year seed data. */
export const TODAY = new Date(2026, 8, 2);

const CHUSEOK_2026 = new Date(2026, 8, 25);

function atNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date: Date, days: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + days);
  return next;
}

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

function dayDiff(from: Date, to: Date): number {
  const ms = atNoon(to).getTime() - atNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

function dayFromWeekLabel(week?: string): number {
  if (!week) return 15;
  if (week.includes("1주") || week.includes("첫째")) return 5;
  if (week.includes("2주") || week.includes("둘째")) return 12;
  if (week.includes("3주") || week.includes("셋째")) return 19;
  if (week.includes("4주") || week.includes("말") || week.includes("마지막")) return 26;
  if (week.includes("2월 말")) return 28;
  return 15;
}

export function estimateEventDate(event: ClubEvent, academicYear: number): Date {
  if (event.event_date) return atNoon(new Date(event.event_date));
  return atNoon(new Date(academicYear, event.target_month - 1, dayFromWeekLabel(event.target_week)));
}

export function estimateGiftDate(gift: GiftOccasion, academicYear: number): Date {
  if (gift.occasion.includes("추석")) return atNoon(CHUSEOK_2026);
  return atNoon(new Date(academicYear, gift.target_month - 1, 20));
}

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

export function buildBoard(data: ClubData, today: Date = TODAY) {
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

export function formatDate(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}`;
}

export function formatRange(start: Date, end: Date): string {
  return `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
}

export function taskDdayLabel(dueDate: Date, today: Date = TODAY): { text: string; tone: "late" | "today" | "soon" | "later" } {
  const days = dayDiff(today, dueDate);
  if (days < 0) return { text: `지연 ${Math.abs(days)}일`, tone: "late" };
  if (days === 0) return { text: "오늘", tone: "today" };
  if (days <= 3) return { text: `D-${days}`, tone: "soon" };
  return { text: `D-${days}`, tone: "later" };
}

const STORAGE_KEY = "uniclub-done-v1";

export function loadDoneIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveDoneIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}
