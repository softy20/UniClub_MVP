import type {
  ClarifyingQuestion,
  ClubData,
  ClubEvent,
  ClubProfile,
  ClubTask,
  OnboardingQuestion,
  OnboardingQuestionCategory,
  QuestionOption,
  RoleDefinition,
} from "../../../src/lib/types.ts";

const QUESTION_CATEGORIES: OnboardingQuestionCategory[] = ["roles", "aliases", "club_name"];
const GENERIC_CLUB_NAMES = new Set(["", "동아리", "미상", "unknown", "클럽", "club"]);

export function currentAcademicYear(): number {
  return new Date().getFullYear();
}

type ClubTaskShape = Pick<
  ClubTask,
  "task_name" | "days_before_dday" | "assigned_role" | "is_mandatory"
>;
type ClubEventShape = Pick<ClubEvent, "event_id" | "event_name" | "category" | "target_month" | "tasks">;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRoleDefinition(value: unknown): value is RoleDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.role_name === "string" &&
    value.role_name.trim().length > 0 &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string") &&
    (value.description === undefined || typeof value.description === "string")
  );
}

export function isQuestionOption(value: unknown): value is QuestionOption {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    (value.is_other === undefined || typeof value.is_other === "boolean")
  );
}

export function isOtherOption(option: QuestionOption): boolean {
  return option.is_other === true || option.id === "other" || option.label.includes("기타");
}

export function ensureQuestionOptions(question: ClarifyingQuestion): ClarifyingQuestion {
  const options = question.options.map((option) => ({
    id: option.id.trim(),
    label: option.label.trim(),
    ...(isOtherOption(option) ? { is_other: true } : {}),
  }));
  if (options.length === 0) {
    options.push({ id: "confirm", label: "네, 이대로 확정" }, { id: "merge", label: "부서 명칭 통합" });
  }
  if (!options.some(isOtherOption)) {
    options.push({ id: "other", label: "기타(직접 입력)", is_other: true });
  }
  return { ...question, options };
}

export function parseClarifyingQuestion(value: unknown): ClarifyingQuestion | null {
  if (!isRecord(value) || typeof value.question !== "string" || !value.question.trim()) {
    return null;
  }
  const category = QUESTION_CATEGORIES.includes(value.category as OnboardingQuestionCategory)
    ? (value.category as OnboardingQuestionCategory)
    : "roles";
  const options = Array.isArray(value.options) ? value.options.filter(isQuestionOption) : [];
  return ensureQuestionOptions({
    category,
    question: value.question.trim(),
    options,
  });
}

export function isOnboardingQuestion(value: unknown): value is OnboardingQuestion {
  return parseClarifyingQuestion(value) !== null;
}

export function normalizeQuestions(value: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseClarifyingQuestion)
    .filter((question): question is ClarifyingQuestion => question !== null)
    .slice(0, 2);
}

export function withClubNameQuestion(clubName: string, questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
  const name = clubName.trim();
  if (!GENERIC_CLUB_NAMES.has(name.toLowerCase()) && name.length >= 2) {
    return questions;
  }
  if (questions.some((question) => question.category === "club_name")) {
    return questions;
  }
  const clubQuestion = ensureQuestionOptions({
    category: "club_name",
    question: "매뉴얼에서 동아리 이름이 분명하지 않습니다. 공식 명칭이 무엇인가요?",
    options: [{ id: "other", label: "기타(직접 입력)", is_other: true }],
  });
  return [clubQuestion, ...questions].slice(0, 2);
}

export function isClubProfile(value: unknown): value is ClubProfile {
  if (!isRecord(value)) return false;
  return (
    typeof value.club_name === "string" &&
    typeof value.academic_year === "number" &&
    Array.isArray(value.roles) &&
    value.roles.length > 0 &&
    value.roles.every(isRoleDefinition) &&
    typeof value.default_role === "string" &&
    value.default_role.trim().length > 0 &&
    typeof value.locked === "boolean"
  );
}

function isClubTask(value: unknown): value is ClubTaskShape {
  if (!isRecord(value)) return false;
  return (
    typeof value.task_name === "string" &&
    typeof value.days_before_dday === "number" &&
    typeof value.assigned_role === "string" &&
    typeof value.is_mandatory === "boolean"
  );
}

function isClubEvent(value: unknown): value is ClubEventShape {
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

export function normalizeRole(role: RoleDefinition): RoleDefinition {
  const roleName = role.role_name.trim();
  const aliases = role.aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0 && alias !== roleName);
  return {
    role_name: roleName,
    aliases: [...new Set(aliases)],
    ...(role.description?.trim() ? { description: role.description.trim() } : {}),
  };
}

export function lockClubProfile(input: ClubProfile): ClubProfile {
  const roles = dedupeRoles(input.roles.map(normalizeRole).filter((role) => role.role_name));
  const defaultRole = input.default_role.trim() || "공통";
  if (!roles.some((role) => role.role_name === defaultRole)) {
    roles.push({
      role_name: defaultRole,
      aliases: ["공통업무", "미지정", "미배정", "담당없음"],
      description: "담당자가 명시되지 않은 공통 업무",
    });
  }
  return {
    club_name: input.club_name.trim() || "동아리",
    academic_year: currentAcademicYear(),
    roles,
    default_role: defaultRole,
    locked: true,
  };
}

export function resolveAssignedRole(raw: string, profile: ClubProfile): string {
  const needle = raw.trim();
  if (!needle) return profile.default_role;
  const exact = profile.roles.find((role) => role.role_name === needle);
  if (exact) return exact.role_name;
  const alias = profile.roles.find((role) => role.aliases.includes(needle));
  if (alias) return alias.role_name;
  return profile.default_role;
}

export function constrainClubData(data: ClubData, profile: ClubProfile): ClubData {
  return {
    ...data,
    club_info: {
      ...data.club_info,
      club_name: profile.club_name,
      academic_year: profile.academic_year,
      roles: profile.roles.map((role) => ({
        role_name: role.role_name,
        ...(role.description ? { description: role.description } : {}),
      })),
    },
    events: data.events.map((event) => ({
      ...event,
      tasks: event.tasks.map((task) => ({
        ...task,
        assigned_role: resolveAssignedRole(task.assigned_role, profile),
      })),
    })),
  };
}

function dedupeRoles(roles: RoleDefinition[]): RoleDefinition[] {
  const seen = new Map<string, RoleDefinition>();
  for (const role of roles) {
    const existing = seen.get(role.role_name);
    if (!existing) {
      seen.set(role.role_name, role);
      continue;
    }
    seen.set(role.role_name, {
      ...existing,
      aliases: [...new Set([...existing.aliases, ...role.aliases])],
      description: existing.description ?? role.description,
    });
  }
  return [...seen.values()];
}
