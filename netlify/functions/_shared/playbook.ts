import { isInferredTask, type ClubEvent, type ClubGenre, type ClubProfile, type ClubTask } from "../../../src/lib/types.ts";

type PlaybookItem = {
  id: string;
  task_name: string;
  days_before_dday: number;
  match: RegExp;
  prefer: RegExp;
};

const COMMON_PREP: PlaybookItem[] = [
  {
    id: "venue",
    task_name: "장소 대여/예약",
    days_before_dday: 14,
    match: /장소|대여|예약|숙소|대관/,
    prefer: /기획|운영/,
  },
  {
    id: "notice",
    task_name: "인원 조사 및 공지",
    days_before_dday: 14,
    match: /공지|인원|조사|안내/,
    prefer: /홍보/,
  },
  {
    id: "supply",
    task_name: "물품/예산 준비",
    days_before_dday: 7,
    match: /물품|장보기|예산|준비물|구매/,
    prefer: /총무|재정/,
  },
  {
    id: "dayof",
    task_name: "당일 진행 및 역할 확인",
    days_before_dday: 0,
    match: /당일|현장\s*진행|진행\s*요원/,
    prefer: /운영|기획/,
  },
  {
    id: "settle",
    task_name: "정산 및 증빙 정리",
    days_before_dday: 0,
    match: /정산|영수증|증빙/,
    prefer: /총무|재정/,
  },
];

const GENRE_PREP: Record<ClubGenre, PlaybookItem[]> = {
  sports: [
    { id: "insurance", task_name: "보험 가입", days_before_dday: 7, match: /보험|공제/, prefer: /총무|안전/ },
    { id: "gear", task_name: "장비 점검", days_before_dday: 3, match: /장비|점검/, prefer: /장비|훈련/ },
    { id: "vehicle", task_name: "차량 배차", days_before_dday: 7, match: /차량|버스|배차|교통/, prefer: /총무|운영/ },
  ],
  performance: [
    { id: "hall", task_name: "공연장 대관", days_before_dday: 30, match: /대관|공연장|무대/, prefer: /기획|공연/ },
    { id: "rehearsal", task_name: "리허설 일정 확정", days_before_dday: 14, match: /리허설|연습/, prefer: /공연|기획/ },
    { id: "promo", task_name: "홍보물 제작·배포", days_before_dday: 14, match: /홍보|포스터|카드뉴스/, prefer: /홍보/ },
  ],
  academic: [
    { id: "speaker", task_name: "발표자/연사 확정", days_before_dday: 14, match: /발표|연사|강연/, prefer: /학술|기획/ },
    { id: "materials", task_name: "자료 인쇄·공유", days_before_dday: 3, match: /자료|인쇄|슬라이드/, prefer: /학술|기획/ },
    { id: "room", task_name: "세미나 장소 확보", days_before_dday: 14, match: /장소|세미나|강의실|대관/, prefer: /기획|운영/ },
  ],
  volunteer: [
    { id: "org", task_name: "대상기관 협의", days_before_dday: 21, match: /기관|협의|섭외/, prefer: /봉사|기획/ },
    { id: "headcount", task_name: "참여 인원 확정", days_before_dday: 7, match: /인원|참가|명단/, prefer: /운영|홍보/ },
  ],
  social: [
    { id: "stay", task_name: "숙소 예약", days_before_dday: 21, match: /숙소|펜션|호텔/, prefer: /기획|운영/ },
    { id: "transport", task_name: "교통 확보", days_before_dday: 14, match: /교통|버스|차량|기차/, prefer: /총무|운영/ },
    { id: "budget", task_name: "참가비·예산 확정", days_before_dday: 14, match: /예산|참가비|회비/, prefer: /총무|재정/ },
  ],
  other: [],
};

const MAX_INFERRED_PER_EVENT = 6;
const SKIP_ENRICH_WHEN_EXTRACTED_AT = 4;

function pickRole(profile: ClubProfile, prefer: RegExp): string {
  const hit = profile.roles.find((role) => prefer.test(role.role_name));
  return hit?.role_name ?? profile.default_role;
}

function tagTaskSource(task: ClubTask): ClubTask {
  return {
    ...task,
    source: isInferredTask(task) ? "inferred" : "extracted",
  };
}

export function enrichEventTasks(event: ClubEvent, profile: ClubProfile, genre: ClubGenre): ClubEvent {
  const tasks = event.tasks.map(tagTaskSource);
  const extractedCount = tasks.filter((task) => !isInferredTask(task)).length;
  if (extractedCount >= SKIP_ENRICH_WHEN_EXTRACTED_AT) {
    return { ...event, tasks };
  }

  const catalog = [...GENRE_PREP[genre], ...COMMON_PREP];
  const inferred: ClubTask[] = [];
  for (const item of catalog) {
    if (inferred.length >= MAX_INFERRED_PER_EVENT) break;
    const already = [...tasks, ...inferred].some((task) => item.match.test(task.task_name));
    if (already) continue;
    if (item.id === "stay" || item.id === "transport") {
      const venue = `${event.event_name} ${event.location ?? ""} ${tasks.map((task) => task.task_name).join(" ")}`;
      if (/댁|자택|본가|우리집|자집/.test(venue)) continue;
    }
    inferred.push({
      task_id: `${event.event_id}_inferred_${item.id}`,
      task_name: item.task_name,
      days_before_dday: item.days_before_dday,
      assigned_role: pickRole(profile, item.prefer),
      is_mandatory: true,
      action_details: "원문에 없어 장르 표준 준비로 보충",
      source: "inferred",
    });
  }
  if (inferred.length === 0) return { ...event, tasks };
  return { ...event, tasks: [...tasks, ...inferred] };
}
