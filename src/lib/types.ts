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

export type BoardTask = {
  id: string;
  name: string;
  eventName: string;
  eventId: string;
  eventDate: Date;
  dueDate: Date;
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
