import type { ClubData } from "./types";

export const CLUB_STORAGE_KEY = "uniclub-club-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClubTask(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.task_name === "string" &&
    typeof value.days_before_dday === "number" &&
    typeof value.assigned_role === "string" &&
    typeof value.is_mandatory === "boolean"
  );
}

function isClubEvent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.event_id === "string" &&
    typeof value.event_name === "string" &&
    typeof value.category === "string" &&
    typeof value.target_month === "number" &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isClubTask)
  );
}

export function isClubData(value: unknown): value is ClubData {
  if (!isRecord(value)) return false;
  const clubInfo = value.club_info;
  const events = value.events;
  if (!isRecord(clubInfo) || !Array.isArray(events)) return false;
  if (typeof clubInfo.club_name !== "string" || typeof clubInfo.academic_year !== "number") {
    return false;
  }
  if (!Array.isArray(clubInfo.roles)) return false;
  return events.every(isClubEvent);
}

export function loadClubData(seed: ClubData): ClubData {
  try {
    const raw = localStorage.getItem(CLUB_STORAGE_KEY);
    if (!raw) return seed;
    const parsed: unknown = JSON.parse(raw);
    return isClubData(parsed) ? parsed : seed;
  } catch {
    return seed;
  }
}

export function saveClubData(data: ClubData): void {
  localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(data));
}
