/**
 * 🧭 UniClub - types.ts
 *
 * 이 프로젝트 전체에서 쓰는 데이터의 "모양(설계도)"을 정의해 놓은 파일입니다.
 * 동아리 정보, 행사, 할 일, 선물, 온보딩 질문 등이 어떤 형태(어떤 값들을 가지는지)인지 여기서 정합니다.
 * 실제로 동작하는 코드는 없고, 타입(설계도)만 모여 있습니다.
 *
 * 📌 주요 기능:
 * - 할 일(Task) 하나의 데이터 구조 정의 (이름, 담당자, 마감일 등)
 * - 동아리 장르(공연, 스포츠, 학술 등) 목록과 이를 다루는 헬퍼 함수 제공
 * - 행사(Event), 선물/기념일(Gift), 동아리 전체 데이터(ClubData)의 구조 정의
 * - 보드 화면, 운영 화면에서 쓰는 데이터 구조 정의
 * - 온보딩(첫 설정) 과정에서 쓰는 질문/답변 구조 정의
 *
 * 🔗 사용 예시:
 * ```ts
 * // 다른 파일에서 타입을 가져다 쓸 때 이렇게 씁니다
 * import type { ClubData, ClubEvent, BoardTask } from './types'
 * import { isInferredTask, CLUB_GENRES } from './types'
 *
 * function printEvent(event: ClubEvent) { console.log(event.event_name); }
 * ```
 *
 * 🎯 주요 관리 요소:
 * - TaskSource, ClubTask, isInferredTask: 할 일 데이터와 "AI 추측 여부" 판단 함수
 * - CLUB_GENRES, ClubGenre, isClubGenre, clubGenreLabel: 동아리 장르 목록과 관련 함수
 * - ClubEvent, GiftOccasion, ClubData: 행사/선물/동아리 전체 데이터 구조
 * - BoardTask, UpcomingEvent: 보드(할 일 보드) 화면에서 쓰는 데이터 구조
 * - RoleDefinition, CategoryDefinition, ClubProfile: 역할/카테고리/동아리 프로필 구조
 * - OnboardingQuestionCategory, QuestionOption, ClarifyingQuestion, OnboardingQuestion, OnboardingChatMessage: 온보딩(첫 설정 대화) 관련 타입
 *
 * 💡 팁 및 주의사항:
 * - 이 파일은 "타입 전용" 파일이라 실행되는 로직이 거의 없습니다 (isInferredTask, isClubGenre, clubGenreLabel 정도만 실제 함수).
 * - 새로운 데이터 형태가 필요하면 여기에 타입을 추가하고, 다른 파일에서 import type으로 가져다 쓰세요.
 * - ClubTask의 task_id에 "_inferred_"라는 문자열이 들어있으면 AI가 추측해서 만든 할 일로 취급됩니다.
 *
 * @file types.ts
 * @module lib/types
 */

export type TaskSource = "extracted" | "inferred";

export type ClubTask = {
  task_id?: string;
  task_name: string;
  days_before_dday: number;
  assigned_role: string;
  is_mandatory: boolean;
  action_details?: string;
  checklist?: string[];
  source?: TaskSource;
};

export function isInferredTask(task: ClubTask): boolean {
  return task.source === "inferred" || Boolean(task.task_id?.includes("_inferred_"));
}

export const CLUB_GENRES = [
  { id: "performance", label: "공연" },
  { id: "sports", label: "스포츠" },
  { id: "academic", label: "학술" },
  { id: "volunteer", label: "봉사" },
  { id: "social", label: "취미·친목" },
  { id: "other", label: "기타" },
] as const;

export type ClubGenre = (typeof CLUB_GENRES)[number]["id"];

export function isClubGenre(value: unknown): value is ClubGenre {
  return typeof value === "string" && CLUB_GENRES.some((genre) => genre.id === value);
}

export function clubGenreLabel(genre: ClubGenre): string {
  return CLUB_GENRES.find((item) => item.id === genre)?.label ?? "기타";
}

export type ClubEvent = {
  event_id: string;
  event_name: string;
  category: string;
  target_month: number;
  target_week?: string;
  event_date?: string;
  location?: string;
  tasks: ClubTask[];
};

export type GiftOccasion = {
  occasion: string;
  target_month: number;
  recipients: string[];
  budget_limit_krw?: number;
  budget_source?: string;
  recommended_items?: string[];
  precaution?: string;
};

export type ClubData = {
  club_info: {
    club_name: string;
    academic_year: number;
    club_genre?: string;
    roles: { role_name: string; description?: string }[];
  };
  events: ClubEvent[];
  gifts_and_anniversaries?: GiftOccasion[];
  monthly_timelines?: {
    month: number;
    monthly_focus: string;
  }[];
};

/** 로그인한 사용자가 속한 동아리 하나(계정 <-> 동아리 N:M 관계의 한 행). */
export type ClubSummary = {
  id: string;
  name: string;
  role: "owner" | "member";
};

export type BoardTask = {
  id: string;
  name: string;
  eventName: string;
  eventId: string;
  eventDate: Date;
  dueDate: Date;
  /** 행사일 며칠 전까지 끝내야 하는지(행사 기준 고정값). 오늘 기준 남은 일수는 dueDate에서 따로 계산한다. */
  daysBefore: number;
  role: string;
  mandatory: boolean;
  details?: string;
  checklist: string[];
};

export type UpcomingEvent = {
  eventId: string;
  eventName: string;
  eventDate: Date;
  daysLeft: number;
  location?: string;
};

export type RoleDefinition = {
  role_name: string;
  aliases: string[];
  description?: string;
};

export type CategoryDefinition = {
  label: string;
  aliases: string[];
};

export type ClubProfile = {
  club_name: string;
  academic_year: number;
  roles: RoleDefinition[];
  default_role: string;
  categories: CategoryDefinition[];
  default_category: string;
  locked: boolean;
};

export type OnboardingQuestionCategory = "roles" | "aliases" | "club_name" | "event_categories";

export type QuestionOption = {
  id: string;
  label: string;
  is_other?: boolean;
};

export type ClarifyingQuestion = {
  category: OnboardingQuestionCategory;
  question: string;
  options: QuestionOption[];
};

export type OnboardingQuestion = ClarifyingQuestion;

export type OnboardingChatMessage = {
  role: "user" | "assistant";
  content: string;
};
