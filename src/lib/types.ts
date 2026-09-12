export type ClubTask = {
  task_id?: string;
  task_name: string;
  days_before_dday: number;
  assigned_role: string;
  is_mandatory: boolean;
  action_details?: string;
  checklist?: string[];
};

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

export type ClubProfile = {
  club_name: string;
  academic_year: number;
  roles: RoleDefinition[];
  default_role: string;
  locked: boolean;
};

export type OnboardingQuestionCategory = "roles" | "aliases" | "default_role";

export type OnboardingQuestion = {
  category: OnboardingQuestionCategory;
  question: string;
};

export type OnboardingChatMessage = {
  role: "user" | "assistant";
  content: string;
};
