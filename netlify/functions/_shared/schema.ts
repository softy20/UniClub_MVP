import {
  isClubGenre,
  type CategoryDefinition,
  type ClarifyingQuestion,
  type ClubData,
  type ClubEvent,
  type ClubGenre,
  type ClubProfile,
  type ClubTask,
  type OnboardingQuestion,
  type OnboardingQuestionCategory,
  type QuestionOption,
  type RoleDefinition,
} from "../../../src/lib/types.ts";
import { mergeClubEvents } from "../../../src/lib/parse-events.ts";
import { enrichEventTasks } from "./playbook.ts";

const QUESTION_CATEGORIES: OnboardingQuestionCategory[] = ["roles", "aliases", "club_name", "event_categories"];
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

export function isCategoryDefinition(value: unknown): value is CategoryDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string")
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
  if (option.id === "other" || option.label.includes("직접 입력")) return true;
  return option.is_other === true && !option.label.includes("기타로");
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
    Array.isArray(value.categories) &&
    value.categories.length > 0 &&
    value.categories.every(isCategoryDefinition) &&
    typeof value.default_category === "string" &&
    value.default_category.trim().length > 0 &&
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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function coerceClubTask(value: unknown): ClubTask | null {
  if (!isRecord(value)) return null;
  const taskName = asOptionalString(value.task_name);
  if (!taskName) return null;
  const days = asFiniteNumber(value.days_before_dday);
  const task: ClubTask = {
    task_name: taskName,
    days_before_dday: days === null ? 7 : Math.max(0, Math.round(days)),
    assigned_role: asOptionalString(value.assigned_role) ?? "",
    is_mandatory: asBoolean(value.is_mandatory, false),
  };
  const taskId = asOptionalString(value.task_id);
  const details = asOptionalString(value.action_details);
  const source = value.source === "inferred" || value.source === "extracted" ? value.source : undefined;
  const checklist = Array.isArray(value.checklist)
    ? value.checklist.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  return {
    ...task,
    ...(taskId ? { task_id: taskId } : {}),
    ...(details ? { action_details: details } : {}),
    ...(checklist && checklist.length > 0 ? { checklist } : {}),
    ...(source ? { source } : {}),
  };
}

function coerceClubEvent(value: unknown, index: number): ClubEvent | null {
  if (!isRecord(value)) return null;
  const eventName = asOptionalString(value.event_name);
  if (!eventName) return null;
  const month = asFiniteNumber(value.target_month);
  if (month === null) return null;
  const eventId = asOptionalString(value.event_id) ?? `evt_${index + 1}`;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.map(coerceClubTask).filter((task): task is ClubTask => task !== null)
    : [];
  const event: ClubEvent = {
    event_id: eventId,
    event_name: eventName,
    category: asOptionalString(value.category) ?? "",
    target_month: Math.min(12, Math.max(1, Math.round(month))),
    tasks,
  };
  const week = asOptionalString(value.target_week);
  const date = asOptionalString(value.event_date);
  const location = asOptionalString(value.location);
  return {
    ...event,
    ...(week ? { target_week: week } : {}),
    ...(date ? { event_date: date } : {}),
    ...(location ? { location } : {}),
  };
}

export function coerceClubData(value: unknown): ClubData | null {
  if (isClubData(value)) return value;
  if (!isRecord(value) || !isRecord(value.club_info)) return null;
  const clubName = asOptionalString(value.club_info.club_name);
  const year = asFiniteNumber(value.club_info.academic_year);
  if (!clubName || year === null) return null;
  const eventsRaw = Array.isArray(value.events) ? value.events : [];
  const roles = Array.isArray(value.club_info.roles)
    ? value.club_info.roles
        .filter(isRecord)
        .map((role) => ({
          role_name: asOptionalString(role.role_name) ?? "",
          ...(asOptionalString(role.description) ? { description: asOptionalString(role.description) } : {}),
        }))
        .filter((role) => role.role_name)
    : [];
  const events = eventsRaw
    .map((event, index) => coerceClubEvent(event, index))
    .filter((event): event is ClubEvent => event !== null);
  const genre = asOptionalString(value.club_info.club_genre);
  return {
    club_info: {
      club_name: clubName,
      academic_year: Math.round(year),
      ...(genre ? { club_genre: genre } : {}),
      roles,
    },
    events,
  };
}

export const COMMON_ROLE: RoleDefinition = {
  role_name: "공통",
  aliases: ["공통업무", "미지정", "미배정", "담당없음"],
  description: "역할이 아직 나뉘지 않은 업무",
};

export const COMMON_CATEGORY: CategoryDefinition = {
  label: "기타",
  aliases: ["미분류", "기타행사"],
};

export function ensureDraftRoles(roles: RoleDefinition[]): RoleDefinition[] {
  const normalized = dedupeRoles(roles.map(normalizeRole).filter((role) => role.role_name));
  return normalized.length > 0 ? normalized : [COMMON_ROLE];
}

export function ensureDraftCategories(categories: CategoryDefinition[]): CategoryDefinition[] {
  const normalized = dedupeCategories(categories.map(normalizeCategory).filter((item) => item.label));
  return normalized.length > 0 ? normalized : [COMMON_CATEGORY];
}

export function withEmptyRolesQuestion(roles: RoleDefinition[], questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
  const onlyCommon = roles.length === 1 && roles[0].role_name === COMMON_ROLE.role_name;
  if (!onlyCommon || questions.some((question) => question.category === "roles")) {
    return questions;
  }
  const rolesQuestion = ensureQuestionOptions({
    category: "roles",
    question: "문서에 부서/직책이 없습니다. 역할 없이 공통으로 진행할까요? 나중에 나누어도 됩니다.",
    options: [
      { id: "common", label: "부서 없이 진행 (공통)" },
      { id: "add", label: "부서/직책을 추가로 알려줄게요" },
      { id: "other", label: "기타(직접 입력)", is_other: true },
    ],
  });
  return [rolesQuestion, ...questions].slice(0, 2);
}

export function withCategoriesQuestion(
  categories: CategoryDefinition[],
  questions: ClarifyingQuestion[],
): ClarifyingQuestion[] {
  if (questions.some((question) => question.category === "event_categories")) {
    return questions;
  }
  const onlyCommon = categories.length === 1 && categories[0].label === COMMON_CATEGORY.label;
  const labels = categories.map((item) => item.label).join(", ");
  const categoryQuestion = ensureQuestionOptions(
    onlyCommon
      ? {
          category: "event_categories",
          question: "문서에서 행사 분류가 분명하지 않습니다. 기본 분류(기타)로 진행할까요?",
          options: [
            { id: "common", label: "기타로 진행" },
            { id: "add", label: "분류를 추가로 알려줄게요" },
            { id: "other", label: "기타(직접 입력)", is_other: true },
          ],
        }
      : {
          category: "event_categories",
          question: `이 행사 분류로 진행할까요? (${labels})`,
          options: [
            { id: "confirm", label: "네, 이대로 확정" },
            { id: "edit", label: "분류 이름 수정" },
            { id: "other", label: "기타(직접 입력)", is_other: true },
          ],
        },
  );
  if (questions.length >= 2) return questions;
  return [...questions, categoryQuestion];
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

export function normalizeCategory(category: CategoryDefinition): CategoryDefinition {
  const label = category.label.trim();
  const aliases = category.aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0 && alias !== label);
  return { label, aliases: [...new Set(aliases)] };
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
  const categories = ensureDraftCategories(input.categories ?? []);
  const defaultCategory = input.default_category.trim() || COMMON_CATEGORY.label;
  if (!categories.some((item) => item.label === defaultCategory)) {
    categories.push({
      ...COMMON_CATEGORY,
      label: defaultCategory,
    });
  }
  return {
    club_name: input.club_name.trim() || "동아리",
    academic_year: currentAcademicYear(),
    roles,
    default_role: defaultRole,
    categories,
    default_category: defaultCategory,
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

export function resolveEventCategory(raw: string, profile: ClubProfile): string {
  const needle = raw.trim();
  if (!needle) return profile.default_category;
  const exact = profile.categories.find((item) => item.label === needle);
  if (exact) return exact.label;
  const alias = profile.categories.find((item) => item.aliases.includes(needle));
  if (alias) return alias.label;
  return profile.default_category;
}

export function parseClubGenre(value: unknown): ClubGenre {
  return isClubGenre(value) ? value : "other";
}

export function constrainClubData(data: ClubData, profile: ClubProfile, genre: ClubGenre = "other"): ClubData {
  return {
    ...data,
    club_info: {
      ...data.club_info,
      club_name: profile.club_name,
      academic_year: profile.academic_year,
      club_genre: genre,
      roles: profile.roles.map((role) => ({
        role_name: role.role_name,
        ...(role.description ? { description: role.description } : {}),
      })),
    },
    events: mergeClubEvents(data.events).map((event) =>
      enrichEventTasks(
        {
          ...event,
          category: resolveEventCategory(event.category, profile),
          tasks: event.tasks.map((task) => ({
            ...task,
            assigned_role: resolveAssignedRole(task.assigned_role, profile),
          })),
        },
        profile,
        genre,
      ),
    ),
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

function dedupeCategories(categories: CategoryDefinition[]): CategoryDefinition[] {
  const seen = new Map<string, CategoryDefinition>();
  for (const category of categories) {
    const existing = seen.get(category.label);
    if (!existing) {
      seen.set(category.label, category);
      continue;
    }
    seen.set(category.label, {
      ...existing,
      aliases: [...new Set([...existing.aliases, ...category.aliases])],
    });
  }
  return [...seen.values()];
}
