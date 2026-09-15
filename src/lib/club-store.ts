import type { ClubData, ClubEvent, ClubTask } from "./types";

export const CLUB_STORAGE_KEY = "uniclub-club-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }
  return null;
}

function coerceTask(value: unknown): ClubTask | null {
  if (!isRecord(value) || typeof value.task_name !== "string") return null;
  const days = asNumber(value.days_before_dday);
  if (days === null || typeof value.assigned_role !== "string") return null;
  return {
    ...(value as ClubTask),
    task_name: value.task_name,
    days_before_dday: days,
    assigned_role: value.assigned_role,
    is_mandatory: value.is_mandatory === true,
  };
}

function coerceEvent(value: unknown): ClubEvent | null {
  if (!isRecord(value)) return null;
  const month = asNumber(value.target_month);
  if (
    typeof value.event_id !== "string" ||
    typeof value.event_name !== "string" ||
    typeof value.category !== "string" ||
    month === null ||
    !Array.isArray(value.tasks)
  ) {
    return null;
  }
  const tasks = value.tasks.map(coerceTask).filter((task): task is ClubTask => task !== null);
  return {
    ...(value as ClubEvent),
    event_id: value.event_id,
    event_name: value.event_name,
    category: value.category,
    target_month: month,
    tasks,
  };
}

export function isClubData(value: unknown): value is ClubData {
  return coerceClubData(value) !== null;
}

function coerceClubData(value: unknown): ClubData | null {
  if (!isRecord(value)) return null;
  const clubInfo = value.club_info;
  const events = value.events;
  const year = isRecord(clubInfo) ? asNumber(clubInfo.academic_year) : null;
  if (!isRecord(clubInfo) || !Array.isArray(events) || typeof clubInfo.club_name !== "string" || year === null) {
    return null;
  }
  if (!Array.isArray(clubInfo.roles)) return null;
  const coercedEvents = events.map(coerceEvent).filter((event): event is ClubEvent => event !== null);
  return {
    ...(value as ClubData),
    club_info: {
      ...clubInfo,
      club_name: clubInfo.club_name,
      academic_year: year,
      roles: clubInfo.roles as ClubData["club_info"]["roles"],
    },
    events: coercedEvents,
  };
}

export function loadClubData(seed: ClubData): ClubData {
  try {
    const raw = localStorage.getItem(CLUB_STORAGE_KEY);
    if (!raw) return seed;
    return coerceClubData(JSON.parse(raw)) ?? seed;
  } catch {
    return seed;
  }
}

export function saveClubData(data: ClubData): void {
  localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(data));
}

export type ClubEventPatch = {
  event_name?: string;
  category?: string;
  event_date?: string;
};

export function patchClubEvent(data: ClubData, eventId: string, patch: ClubEventPatch): ClubData {
  return {
    ...data,
    events: data.events.map((event) => {
      if (event.event_id !== eventId) return event;
      const next = { ...event };
      if (patch.event_name !== undefined) {
        const name = patch.event_name.trim();
        if (name) next.event_name = name;
      }
      if (patch.category !== undefined) {
        const category = patch.category.trim();
        if (category) next.category = category;
      }
      if (patch.event_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.event_date)) {
        next.event_date = patch.event_date;
        const month = Number(patch.event_date.slice(5, 7));
        if (month >= 1 && month <= 12) next.target_month = month;
      }
      return next;
    }),
  };
}
