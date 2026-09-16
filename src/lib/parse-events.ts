import { isInferredTask, type ClubEvent, type ClubTask } from "./types";

const PREP_SUFFIXES = [
  "장소예약",
  "장소대여",
  "대관예약",
  "인원조사및공지",
  "인원조사",
  "증빙정리",
  "뒷풀이장소예약",
  "대여",
  "대관",
  "예약",
  "준비",
  "공지",
  "정산",
];

const TASK_TAILS = ["확인", "확정", "조사", "구하기", "협의", "하기", "준비", "예약", "정리", "구매", "배포"];

function withoutParens(name: string): string {
  return name.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|（[^）]*）/g, " ");
}

function parenBits(name: string): string[] {
  const bits: string[] = [];
  for (const match of name.matchAll(/\(([^)]*)\)|\[([^\]]*)\]|（([^）]*)）/g)) {
    const inner = match[1] ?? match[2] ?? match[3] ?? "";
    if (inner.trim()) bits.push(inner);
  }
  return bits;
}

export function normalizeEventName(name: string): string {
  return withoutParens(name)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/·•.,()[\]{}'"`~!?:;]+/g, "");
}

export function coreEventName(name: string): string {
  let key = normalizeEventName(name).replace(/및/g, "");
  let changed = true;
  while (changed && key.length > 0) {
    changed = false;
    for (const suffix of PREP_SUFFIXES) {
      if (key.endsWith(suffix) && key.length > suffix.length) {
        key = key.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return key || normalizeEventName(name);
}

function coreTaskName(name: string): string {
  let key = normalizeEventName(name).replace(/및/g, "");
  let changed = true;
  while (changed && key.length > 2) {
    changed = false;
    for (const suffix of TASK_TAILS) {
      if (key.endsWith(suffix) && key.length > suffix.length) {
        key = key.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return key || normalizeEventName(name);
}

function namesSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 3) return false;
  return longer.includes(shorter);
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function taskTokens(name: string): string[] {
  const parts = [...withoutParens(name).split(/및/g), ...parenBits(name).flatMap((bit) => bit.split(/[·,/]/))];
  return parts.map((token) => token.replace(/[\s\-_/·•.,()[\]{}'"`~!?:;]+/g, "").toLowerCase()).filter((token) => token.length >= 2);
}

function isVenueTask(name: string): boolean {
  return /장소|대여|대관|방문/.test(name);
}

function mentionsHome(name: string): boolean {
  return /댁|자택|본가|우리집/.test(`${name} ${parenBits(name).join(" ")}`);
}

function sharesHomeVenue(a: string, b: string): boolean {
  return mentionsHome(a) && mentionsHome(b);
}

function tokensOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  let hits = 0;
  for (const token of left) {
    if (right.some((other) => namesSimilar(token, other) || commonPrefixLength(token, other) >= 3)) hits += 1;
  }
  return hits >= Math.min(left.length, right.length) && hits >= 2;
}

export function tasksSimilar(a: string, b: string): boolean {
  const left = coreTaskName(a);
  const right = coreTaskName(b);
  if (!left || !right) return false;
  if (left === right || namesSimilar(left, right)) return true;
  const prefix = commonPrefixLength(left, right);
  const shorter = Math.min(left.length, right.length);
  if (prefix >= 6 && prefix / shorter >= 0.6) return true;
  if (isVenueTask(a) && isVenueTask(b) && sharesHomeVenue(a, b)) return true;
  return tokensOverlap(taskTokens(a), taskTokens(b));
}

function extractedTaskCount(event: ClubEvent): number {
  return event.tasks.filter((task) => !isInferredTask(task)).length;
}

function isRicher(candidate: ClubEvent, current: ClubEvent): boolean {
  const extractedDelta = extractedTaskCount(candidate) - extractedTaskCount(current);
  if (extractedDelta !== 0) return extractedDelta > 0;
  if (candidate.tasks.length !== current.tasks.length) return candidate.tasks.length > current.tasks.length;
  const dated = Number(Boolean(candidate.event_date)) - Number(Boolean(current.event_date));
  if (dated !== 0) return dated > 0;
  return false;
}

function nameHasPrepTail(name: string): boolean {
  return coreEventName(name) !== normalizeEventName(name).replace(/및/g, "");
}

function preferredName(a: ClubEvent, b: ClubEvent): string {
  const aTail = nameHasPrepTail(a.event_name);
  const bTail = nameHasPrepTail(b.event_name);
  if (aTail !== bTail) return aTail ? b.event_name : a.event_name;

  const aCore = coreEventName(a.event_name);
  const bCore = coreEventName(b.event_name);
  if (aCore !== bCore) {
    if (bCore.includes(aCore) && aCore.length >= 3) return b.event_name;
    if (aCore.includes(bCore) && bCore.length >= 3) return a.event_name;
  }
  if (Boolean(a.event_date) !== Boolean(b.event_date)) {
    return a.event_date ? a.event_name : b.event_name;
  }
  return isRicher(a, b) ? a.event_name : b.event_name;
}

function pickTask(existing: ClubTask, incoming: ClubTask): ClubTask {
  const existingInferred = isInferredTask(existing);
  const incomingInferred = isInferredTask(incoming);
  if (existingInferred !== incomingInferred) return incomingInferred ? existing : incoming;
  if (incoming.task_name.length !== existing.task_name.length) {
    return incoming.task_name.length > existing.task_name.length ? incoming : existing;
  }
  const incomingDetail = incoming.action_details?.length ?? 0;
  const existingDetail = existing.action_details?.length ?? 0;
  if (incomingDetail !== existingDetail) return incomingDetail > existingDetail ? incoming : existing;
  return existing;
}

function mergeTasks(left: ClubTask[], right: ClubTask[]): ClubTask[] {
  const merged: ClubTask[] = [];
  for (const task of [...left, ...right]) {
    const name = task.task_name.trim();
    if (!name) continue;
    const index = merged.findIndex((item) => tasksSimilar(item.task_name, name));
    if (index < 0) {
      merged.push(task);
      continue;
    }
    merged[index] = pickTask(merged[index], task);
  }
  return merged;
}

function monthDistance(left: number, right: number): number {
  const diff = Math.abs(left - right);
  return Math.min(diff, 12 - diff);
}

function mergePair(a: ClubEvent, b: ClubEvent): ClubEvent {
  const keep = isRicher(a, b) ? a : b;
  const other = keep === a ? b : a;
  const eventName = preferredName(a, b);
  const named = eventName === a.event_name ? a : b;
  return {
    ...keep,
    event_name: eventName,
    event_date: keep.event_date || other.event_date,
    location: keep.location || other.location,
    target_week: keep.target_week || other.target_week,
    target_month: named.target_month,
    tasks: mergeTasks(a.tasks, b.tasks),
  };
}

function isSameEvent(a: ClubEvent, b: ClubEvent): boolean {
  if (a.event_id === b.event_id) return true;
  const aCore = coreEventName(a.event_name);
  const bCore = coreEventName(b.event_name);
  if (!namesSimilar(aCore, bCore)) return false;
  const distance = monthDistance(a.target_month, b.target_month);
  if (distance === 0) return true;
  if (aCore === bCore) return false;
  return distance <= 2;
}

function looksLikeHomeVenue(event: ClubEvent): boolean {
  const blob = `${event.event_name} ${event.location ?? ""} ${event.tasks.map((task) => task.task_name).join(" ")}`;
  return /댁|자택|본가|우리집/.test(blob);
}

function dropRedundantInferred(event: ClubEvent): ClubEvent {
  const home = looksLikeHomeVenue(event);
  const extracted = event.tasks.filter((task) => !isInferredTask(task));
  const inferred = event.tasks.filter((task) => isInferredTask(task));
  const kept = inferred.filter((task) => {
    if (home && /숙소|펜션|호텔|교통|버스|차량|기차/.test(task.task_name)) return false;
    return !extracted.some((item) => tasksSimilar(item.task_name, task.task_name));
  });
  return { ...event, tasks: [...extracted, ...kept] };
}

export function mergeClubEvents(...groups: Array<ClubEvent[] | null | undefined>): ClubEvent[] {
  const merged: ClubEvent[] = [];

  function consider(event: ClubEvent) {
    const cleaned: ClubEvent = { ...event, tasks: mergeTasks(event.tasks, []) };
    const index = merged.findIndex((item) => isSameEvent(item, cleaned));
    if (index >= 0) {
      merged[index] = mergePair(merged[index], cleaned);
      return;
    }
    merged.push(cleaned);
  }

  for (const group of groups) {
    if (!group) continue;
    for (const event of group) consider(event);
  }

  return merged.map(dropRedundantInferred).sort((a, b) => a.target_month - b.target_month);
}
