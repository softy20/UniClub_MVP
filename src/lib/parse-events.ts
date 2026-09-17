/**
 * 🧭 UniClub - parse-events.ts
 *
 * AI가 여러 번 만들어낸 행사(이벤트) 목록 안에서, 사실은 "같은 행사"인데 이름이 조금씩 다르게 적힌 것들을 찾아 하나로 합쳐주는 파일입니다.
 * 예를 들어 "여름 MT"와 "여름 엠티 장소예약"을 같은 행사로 인식해서 정보를 합칩니다.
 *
 * 📌 주요 기능:
 * - 행사 이름/할 일 이름에서 괄호, 공백, 특수문자를 없애고 비교하기 쉬운 형태로 정규화
 * - "장소예약", "준비", "정산" 같은 접미사를 떼어내서 진짜 핵심 이름만 추출
 * - 두 이름이 비슷한지, 겹치는 단어가 있는지 판단
 * - 같은 행사로 보이는 두 항목을 하나로 합치기 (이름, 날짜, 장소, 할 일 목록 등)
 * - 여러 그룹의 행사 목록을 합쳐서 중복 없는 최종 행사 목록 만들기
 * - 이미 저장되어 있는 시즌 데이터에 새로 파싱한 결과를 안전하게 추가하기
 *
 * 🔗 사용 예시:
 * ```ts
 * // AI가 여러 번 응답한 행사 목록을 합칠 때 이렇게 씁니다
 * import { mergeClubEvents } from './parse-events'
 *
 * const merged = mergeClubEvents(eventsFromStep1, eventsFromStep2);
 * ```
 *
 * 🎯 주요 관리 요소:
 * - normalizeEventName(name), coreEventName(name): 이름을 비교하기 좋은 형태로 다듬는 함수
 * - tasksSimilar(a, b): 두 할 일 이름이 같은 일인지 판단하는 함수
 * - mergeClubEvents(...groups): 여러 행사 목록을 하나로 합치는 메인 함수
 * - mergeSeasonEvents(existing, incoming, academicYear, today): 저장된 시즌 행사에 새로
 *   파싱한 행사를 안전하게 얹는 함수(같은 업로드 안 중복 제거와는 목적이 다름 — 아래 참고)
 *
 * 💡 팁 및 주의사항:
 * - 이 파일의 로직은 문자열 유사도를 규칙(정규식, 접두사 비교 등)으로 판단하는 것이라 100% 정확하지 않을 수 있습니다. 새로운 접미사 패턴이 필요하면 PREP_SUFFIXES, TASK_TAILS 배열에 추가하세요.
 * - mergeClubEvents는 항상 target_month 기준으로 정렬된 새 배열을 반환합니다 (원본 배열은 바꾸지 않음).
 * - isInferredTask(types.ts)에 의존해서, AI가 추측으로 만든 할 일(inferred)과 매뉴얼에서 직접 뽑아낸 할 일(extracted)을 구분해 우선순위를 매깁니다.
 * - mergeClubEvents/mergePair/pickTask는 "같은 업로드 안에서 AI가 여러 조각으로 나눠 만든
 *   결과"끼리 합칠 때 쓰는 것이라 "더 알찬 쪽을 통째로 채택"해도 된다(둘 다 아직 저장 전이라
 *   잃을 게 없음). 반면 mergeSeasonEvents는 "이미 저장되어 화면에 반영된 데이터" 위에 얹는
 *   것이라 정반대 원칙을 쓴다 — 기존 행사의 이름/날짜/월/장소는 절대 안 바꾸고, 정말 새로
 *   생긴 행사·할 일만 추가한다. 그래서 mergePair/pickTask를 재사용하지 않고 별도로 구현했다.
 *
 * @file parse-events.ts
 * @module lib/parse-events
 */

import { isInferredTask, type ClubEvent, type ClubTask } from "./types";
import { dayDiff, estimateEventDate } from "./board";

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

// 기존 할 일은 내용을 절대 바꾸지 않는다 - 이름이 비슷한 게 이미 있으면 무시하고,
// 정말 새로운 할 일만 뒤에 덧붙인다. 완료 체크(task_id 기반)가 풀리지 않게 하기 위함.
function mergeExistingWithNewTasks(existingTasks: ClubTask[], incomingTasks: ClubTask[]): ClubTask[] {
  const newTasks = incomingTasks.filter(
    (incoming) => !existingTasks.some((existing) => tasksSimilar(existing.task_name, incoming.task_name)),
  );
  return [...existingTasks, ...newTasks];
}

/**
 * 이미 저장되어 있는 시즌 행사(existingEvents) 위에 새로 파싱한 행사(incomingEvents)를
 * 안전하게 얹는다. 기존 행사의 이름/날짜/월/장소/카테고리는 절대 바꾸지 않고, 이미 지난
 * 행사는 할 일도 손대지 않는다. 아직 안 지난 행사는 정말 새로 생긴 할 일만 추가하고,
 * 완전히 새로운 행사(예: 2학기에 추가된 부스 참여)는 그대로 목록에 더한다.
 */
export function mergeSeasonEvents(
  existingEvents: ClubEvent[],
  incomingEvents: ClubEvent[],
  academicYear: number,
  today: Date,
): ClubEvent[] {
  const usedIncoming = new Set<number>();

  const merged = existingEvents.map((existing) => {
    const matchIndex = incomingEvents.findIndex(
      (candidate, index) => !usedIncoming.has(index) && isSameEvent(existing, candidate),
    );
    if (matchIndex < 0) return existing;

    usedIncoming.add(matchIndex);
    const isPast = dayDiff(today, estimateEventDate(existing, academicYear)) < 0;
    if (isPast) return existing;

    const candidate = incomingEvents[matchIndex];
    return { ...existing, tasks: mergeExistingWithNewTasks(existing.tasks, candidate.tasks) };
  });

  const newEvents = incomingEvents.filter((_, index) => !usedIncoming.has(index));
  return [...merged, ...newEvents];
}
