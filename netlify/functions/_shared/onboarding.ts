import type Anthropic from "@anthropic-ai/sdk";
import type { ClarifyingQuestion, RoleDefinition } from "../../../src/lib/types.ts";
import { isOnboardingQuestion, isRecord, isRoleDefinition } from "./schema.ts";

const QUESTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "question", "options"],
  properties: {
    category: { type: "string", enum: ["roles", "aliases", "club_name"] },
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

export function buildStartSystem(currentYear: number): string {
  return `너는 동아리 인수인계 매뉴얼에서 부서/직책 초안만 추출하는 온보딩 도우미다.

현재 학년도는 ${currentYear}년이다.
academic_year는 반드시 ${currentYear}로 설정하라. 문서에 과거 연도(예: 2024)가 있어도 복사하지 마라.

규칙:
- 행사 일정이나 TO-DO는 추출하지 마라.
- 문서에 실제로 등장하거나 강하게 암시된 부서/팀/직책만 draft_roles로 제안하라.
- 문서에 없는 직책(회장, 부회장, 총무 등)을 관례로 지어내지 마라.
- 비슷한 표기(홍보/홍보팀)는 별칭으로 묶고, 확정하지 못한 동일 조직 여부는 질문으로 남겨라.
- 담당 없는 업무는 묻지 말고 이후 default_role을 "공통"으로 둔다.
- questions는 1~2개만, 아래 범주만 허용한다:
  - roles: 부서/직책 목록 확인
  - aliases: 별칭 및 동일 조직 여부
  - club_name: 동아리 이름 확인
- 동아리명이 없거나 "동아리"/"미상"처럼 모호하면 첫 질문에 category "club_name"을 넣는다.
- 각 질문은 클릭용 options를 반드시 포함한다. 예: "네, 이대로 확정", "부서 명칭 통합", "기타(직접 입력)".
- 마지막 선택지는 반드시 id "other", label "기타(직접 입력)", is_other true 이다.
- 주관식만 묻지 마라. 선택지 버튼으로 답할 수 있게 하라.
- 반드시 propose_club_roles 도구만 호출하라.`;
}

export function buildAnswerSystem(currentYear: number): string {
  return `너는 동아리 부서표를 짧게 확정하는 온보딩 도우미다.

현재 학년도는 ${currentYear}년이다. lock 시 academic_year는 반드시 ${currentYear}이다.
문서의 과거 연도를 사용하지 마라.

질문 범주는 다음만 허용한다:
- roles: 부서/직책 목록 확인
- aliases: 별칭 및 동일 조직 여부
- club_name: 동아리 이름 확인

규칙:
- 일정이 아니라 부서표만 다룬다.
- 문서에 없는 직책을 관례로 추가하지 마라. 사용자가 명시한 것만 추가한다.
- 담당 없는 업무는 묻지 말고 default_role을 "공통"으로 둔다. roles에 "공통"이 없으면 추가한다.
- 정보가 충분하면 즉시 lock_club_profile을 호출한다.
- 모호할 때만 ask_clarifying_questions로 1~2개 더 묻는다.
- 같은 범주를 반복하지 말고, 전체 대화는 최대 4턴이다.
- 추가 질문에도 options 버튼을 넣고, 마지막은 기타(직접 입력)이다.
- lock 시 locked는 반드시 true.`;
}

export const proposeClubRolesTool: Anthropic.Tool = {
  name: "propose_club_roles",
  description: "문서에서 추측한 부서 초안과 확인 질문 1~2개를 제출한다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["club_name", "academic_year", "draft_roles", "questions", "message"],
    properties: {
      club_name: { type: "string" },
      academic_year: { type: "number" },
      draft_roles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role_name", "aliases"],
          properties: {
            role_name: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
        },
      },
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
  description: "부서표 확정 전 허용 범주의 확인 질문 1~2개를 묻는다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["draft_roles", "questions", "message"],
    properties: {
      draft_roles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role_name", "aliases"],
          properties: {
            role_name: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
        },
      },
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
  description: "동아리 전용 부서표를 확정하고 잠근다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["club_name", "academic_year", "roles", "default_role", "message"],
    properties: {
      club_name: { type: "string" },
      academic_year: { type: "number" },
      roles: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role_name", "aliases"],
          properties: {
            role_name: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
        },
      },
      default_role: { type: "string" },
      message: { type: "string" },
    },
  },
};

export type DraftRolesPayload = {
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  questions: ClarifyingQuestion[];
  message: string;
};

export type ClarifyingPayload = {
  draft_roles: RoleDefinition[];
  questions: ClarifyingQuestion[];
  message: string;
};

export type LockPayload = {
  club_name: string;
  academic_year: number;
  roles: RoleDefinition[];
  default_role: string;
  message: string;
};

export function isDraftRolesPayload(value: unknown): value is DraftRolesPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.club_name === "string" &&
    typeof value.academic_year === "number" &&
    Array.isArray(value.draft_roles) &&
    value.draft_roles.every(isRoleDefinition) &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.length <= 2 &&
    value.questions.every(isOnboardingQuestion) &&
    typeof value.message === "string"
  );
}

export function isClarifyingPayload(value: unknown): value is ClarifyingPayload {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.draft_roles) &&
    value.draft_roles.every(isRoleDefinition) &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.length <= 2 &&
    value.questions.every(isOnboardingQuestion) &&
    typeof value.message === "string"
  );
}

export function isLockPayload(value: unknown): value is LockPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.club_name === "string" &&
    typeof value.academic_year === "number" &&
    Array.isArray(value.roles) &&
    value.roles.length > 0 &&
    value.roles.every(isRoleDefinition) &&
    typeof value.default_role === "string" &&
    typeof value.message === "string"
  );
}
