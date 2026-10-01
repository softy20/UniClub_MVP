import type Anthropic from "@anthropic-ai/sdk";
import type { CategoryDefinition, ClarifyingQuestion, ManualImportDepth, RoleDefinition } from "../../../src/lib/types.ts";
import { isCategoryDefinition, isOnboardingQuestion, isRecord, isRoleDefinition } from "./schema.ts";

// depth(간단형/기본형/체계형)에 따라 온보딩 질문에 덧붙일 지시문. 체계형은 기존 동작과 동일하게 추가 지시가 없다.
function depthOnboardingNote(depth: ManualImportDepth): string {
  if (depth === "simple") {
    return `

이 조직은 "간단형"을 선택했다. 부서·직책이 여러 개여도 묻지 말고 draft_roles는 "공통" 하나만 제안하고, roles 범주 질문은 하지 마라. 행사 분류도 세분화해 묻지 말고 draft_categories를 최대 2~3개로 짧게 제안하고 바로 확정 질문 하나만 하라. 전체 질문은 가능하면 1개로 끝내라.`;
  }
  if (depth === "basic") {
    return `

이 조직은 "기본형"을 선택했다. 부서가 명확히 여러 개로 나뉘어 있을 때만 roles 질문을 하고, 애매하면 "공통"으로 묶어 제안하라. 질문은 꼭 필요한 것만 최소로 하라.`;
  }
  return "";
}

const ROLE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["role_name", "aliases"],
  properties: {
    role_name: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    description: { type: "string" },
  },
} as const;

const CATEGORY_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "aliases"],
  properties: {
    label: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
  },
} as const;

const QUESTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "question", "options"],
  properties: {
    category: { type: "string", enum: ["roles", "aliases", "club_name", "event_categories"] },
    question: { type: "string" },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          is_other: { type: "boolean" },
        },
      },
    },
  },
} as const;

/**
 * 온보딩 첫 턴(start-onboarding)에서 쓰는 시스템 프롬프트를 만든다. 매뉴얼에서 부서/직책
 * 초안과 행사 분류 초안을 추출하고 확인 질문 1~2개를 propose_club_roles 도구로만
 * 제출하도록 모델에 지시한다.
 */
export function buildStartSystem(currentYear: number, depth: ManualImportDepth = "full"): string {
  return `너는 동아리 인수인계 매뉴얼에서 부서/직책 초안과 행사 분류 초안을 추출하는 온보딩 도우미다.

현재 학년도는 ${currentYear}년이다.
academic_year는 반드시 ${currentYear}로 설정하라. 문서에 과거 연도(예: 2024)가 있어도 복사하지 마라.

규칙:
- 행사 일정 날짜나 TO-DO는 추출하지 마라. 행사명에서 짧은 분류 라벨만 뽑는다.
- 문서에 실제로 등장하거나 강하게 암시된 부서/팀/직책만 draft_roles로 제안하라.
- 문서에 없는 직책(회장, 부회장, 총무 등)을 관례로 지어내지 마라.
- 부서가 없거나 사적 모임/초기 동아리면 거절하지 마라. draft_roles에 "공통" 하나만 넣고 역할 없이 진행할지 물어라.
- 비슷한 표기(홍보/홍보팀)는 별칭으로 묶고, 확정하지 못한 동일 조직 여부는 질문으로 남겨라.
- 담당 없는 업무는 묻지 말고 이후 default_role을 "공통"으로 둔다.
- draft_categories는 문서에 나온 행사 유형의 짧은 라벨이다. 행사명 전체를 쓰지 마라.
  예: "신입부원 OT" → OT, "해커톤" → 해커톤, "동아리 연합 뒷풀이" → 친목 또는 연합.
  시드 예시(필요하면 이 중에서 고르거나 문서에 맞게 짧게 만들어라): OT, MT, 해커톤, 친목, 연합, 모집, 공연, 봉사, 회의, 부스, 투어.
- 행사가 없으면 draft_categories에 "기타" 하나만 넣어라.
- questions는 1~2개만, 아래 범주만 허용한다:
  - roles: 부서/직책 목록 확인. 부서가 없으면 "부서 없이 진행 (공통)" 선택지를 넣는다.
  - aliases: 별칭 및 동일 조직 여부
  - club_name: 모임/동아리 이름 확인. 사적 모임이어도 이름을 받아라.
  - event_categories: 행사 분류 목록 확인. "네, 이대로 확정", "분류 이름 수정" 선택지를 넣는다.
- 동아리명이 없거나 "동아리"/"미상"처럼 모호하면 첫 질문에 category "club_name"을 넣는다.
- 분류 초안이 있으면 가능하면 event_categories 질문을 포함하라. 슬롯이 없으면 다음 턴에서 묻는다.
- 각 질문은 클릭용 options를 반드시 포함한다. 예: "네, 이대로 확정", "부서 명칭 통합", "기타(직접 입력)".
- 마지막 선택지는 반드시 id "other", label "기타(직접 입력)", is_other true 이다.
- 주관식만 묻지 마라. 선택지 버튼으로 답할 수 있게 하라.
- 반드시 propose_club_roles 도구만 호출하라.${depthOnboardingNote(depth)}`;
}

/**
 * 온보딩 후속 턴(answer-onboarding)에서 쓰는 시스템 프롬프트를 만든다. 부서표와 행사
 * 분류를 짧게 확정하도록, ask_clarifying_questions 또는 lock_club_profile 중 하나를
 * 호출하도록 모델에 지시한다.
 */
export function buildAnswerSystem(currentYear: number, depth: ManualImportDepth = "full"): string {
  return `너는 동아리 부서표와 행사 분류를 짧게 확정하는 온보딩 도우미다.

현재 학년도는 ${currentYear}년이다. lock 시 academic_year는 반드시 ${currentYear}이다.
문서의 과거 연도를 사용하지 마라.

질문 범주는 다음만 허용한다:
- roles: 부서/직책 목록 확인
- aliases: 별칭 및 동일 조직 여부
- club_name: 동아리 이름 확인
- event_categories: 행사 분류 목록 확인

규칙:
- 일정·TO-DO가 아니라 부서표와 행사 분류만 다룬다. 사적 모임·역할 없는 초기 모임도 받아라.
- 문서에 없는 직책을 관례로 추가하지 마라. 사용자가 명시한 것만 추가한다.
- 사용자가 부서 없이 진행/공통/사적 모임을 고르면 roles는 "공통"만 둔다. 그래도 행사 분류는 확인한 뒤에만 lock_club_profile을 호출하라.
- 담당 없는 업무는 묻지 말고 default_role을 "공통"으로 둔다. roles가 비었거나 "공통"이 없으면 추가한다.
- 행사 분류(event_categories)를 아직 확인하지 않았으면 lock하지 말고 분류 질문을 하라.
- 분류 라벨은 짧게 유지하라. 예: OT, 해커톤, 친목, 연합. 행사명 전체를 분류로 쓰지 마라.
- 사용자가 분류를 추가·수정하면 draft_categories / categories에 반영하라. 없으면 "기타"만 둔다.
- 부서와 분류가 모두 충분할 때만 lock_club_profile을 호출한다.
- 모호할 때만 ask_clarifying_questions로 1~2개 더 묻는다.
- 같은 범주를 반복하지 말고, 전체 대화는 최대 4턴이다.
- 추가 질문에도 options 버튼을 넣고, 마지막은 기타(직접 입력)이다.
- lock 시 locked는 반드시 true. categories와 default_category("기타")를 반드시 넣어라.${depthOnboardingNote(depth)}`;
}

export const proposeClubRolesTool: Anthropic.Tool = {
  name: "propose_club_roles",
  description: "문서에서 추측한 부서 초안, 행사 분류 초안, 확인 질문 1~2개를 제출한다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["club_name", "academic_year", "draft_roles", "draft_categories", "questions", "message"],
    properties: {
      club_name: { type: "string" },
      academic_year: { type: "number" },
      draft_roles: { type: "array", items: ROLE_ITEM_SCHEMA },
      draft_categories: { type: "array", items: CATEGORY_ITEM_SCHEMA },
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: QUESTION_ITEM_SCHEMA,
      },
      message: { type: "string", description: "사용자에게 보여줄 짧은 한국어 안내" },
    },
  },
};

export const askClarifyingTool: Anthropic.Tool = {
  name: "ask_clarifying_questions",
  description: "부서표·행사 분류 확정 전 허용 범주의 확인 질문 1~2개를 묻는다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["draft_roles", "draft_categories", "questions", "message"],
    properties: {
      draft_roles: { type: "array", items: ROLE_ITEM_SCHEMA },
      draft_categories: { type: "array", items: CATEGORY_ITEM_SCHEMA },
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: QUESTION_ITEM_SCHEMA,
      },
      message: { type: "string" },
    },
  },
};

export const lockClubProfileTool: Anthropic.Tool = {
  name: "lock_club_profile",
  description: "동아리 전용 부서표와 행사 분류를 확정하고 잠근다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["club_name", "academic_year", "roles", "default_role", "categories", "default_category", "message"],
    properties: {
      club_name: { type: "string" },
      academic_year: { type: "number" },
      roles: { type: "array", minItems: 1, items: ROLE_ITEM_SCHEMA },
      default_role: { type: "string" },
      categories: { type: "array", minItems: 1, items: CATEGORY_ITEM_SCHEMA },
      default_category: { type: "string" },
      message: { type: "string" },
    },
  },
};

export type DraftRolesPayload = {
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  draft_categories: CategoryDefinition[];
  questions: ClarifyingQuestion[];
  message: string;
};

export type ClarifyingPayload = {
  draft_roles: RoleDefinition[];
  draft_categories: CategoryDefinition[];
  questions: ClarifyingQuestion[];
  message: string;
};

export type LockPayload = {
  club_name: string;
  academic_year: number;
  roles: RoleDefinition[];
  default_role: string;
  categories: CategoryDefinition[];
  default_category: string;
  message: string;
};

/**
 * propose_club_roles 도구 호출의 input이 DraftRolesPayload 형태(부서/분류 초안 + 질문
 * 1~2개 + 안내 메시지)를 만족하는지 검사한다.
 */
export function isDraftRolesPayload(value: unknown): value is DraftRolesPayload {
  if (!isRecord(value)) return false;
  const categories = Array.isArray(value.draft_categories) ? value.draft_categories : [];
  return (
    typeof value.club_name === "string" &&
    typeof value.academic_year === "number" &&
    Array.isArray(value.draft_roles) &&
    value.draft_roles.every(isRoleDefinition) &&
    categories.every(isCategoryDefinition) &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.length <= 2 &&
    value.questions.every(isOnboardingQuestion) &&
    typeof value.message === "string"
  );
}

/**
 * ask_clarifying_questions 도구 호출의 input이 ClarifyingPayload 형태를 만족하는지
 * 검사한다.
 */
export function isClarifyingPayload(value: unknown): value is ClarifyingPayload {
  if (!isRecord(value)) return false;
  const categories = Array.isArray(value.draft_categories) ? value.draft_categories : [];
  return (
    Array.isArray(value.draft_roles) &&
    value.draft_roles.every(isRoleDefinition) &&
    categories.every(isCategoryDefinition) &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.length <= 2 &&
    value.questions.every(isOnboardingQuestion) &&
    typeof value.message === "string"
  );
}

/**
 * lock_club_profile 도구 호출의 input이 LockPayload 형태(확정된 부서/분류 목록과 기본값)를
 * 만족하는지 검사한다.
 */
export function isLockPayload(value: unknown): value is LockPayload {
  if (!isRecord(value)) return false;
  const categories = Array.isArray(value.categories) ? value.categories : [];
  return (
    typeof value.club_name === "string" &&
    typeof value.academic_year === "number" &&
    Array.isArray(value.roles) &&
    value.roles.every(isRoleDefinition) &&
    typeof value.default_role === "string" &&
    categories.every(isCategoryDefinition) &&
    (value.default_category === undefined || typeof value.default_category === "string") &&
    typeof value.message === "string"
  );
}
