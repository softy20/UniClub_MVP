import type { CategoryDefinition, OnboardingQuestionCategory, RoleDefinition } from "../../lib/types";
import type { ParseHalf } from "./types";

export const MAX_TURNS = 4;
export const CATEGORY_LABEL: Record<OnboardingQuestionCategory, string> = {
  roles: "부서 확인",
  aliases: "별칭 확인",
  club_name: "동아리명 확인",
  event_categories: "행사 분류 확인",
};
export const PARSE_TIMEOUT_MESSAGE = "일정 파싱이 시간 제한을 넘었습니다. 문서를 나누거나 다시 시도해 주세요.";
export const PARSE_SEASONS: { months: number[]; label: string }[] = [
  { months: [12, 1, 2], label: "동계(12–2월)" },
  { months: [3, 4, 5], label: "1학기(3–5월)" },
  { months: [6, 7, 8], label: "하계(6–8월)" },
  { months: [9, 10, 11], label: "2학기(9–11월)" },
];
export const PARSE_HALVES: Record<ParseHalf, { label: string; chunks: number[][] }> = {
  first: {
    label: "상반기",
    chunks: PARSE_SEASONS.slice(0, 2).map((season) => season.months),
  },
  second: {
    label: "하반기",
    chunks: PARSE_SEASONS.slice(2).map((season) => season.months),
  },
};

export const PARSE_CHUNK_TOTAL = PARSE_SEASONS.length;
export const PARSE_CHUNK_MS = 9000;
export const PARSE_FINISH_MS = 560;
export const SHORT_MANUAL_CHARS = 4000;

export const FALLBACK_ROLE: RoleDefinition = {
  role_name: "공통",
  aliases: ["공통업무", "미지정", "미배정", "담당없음"],
};

export const FALLBACK_CATEGORY: CategoryDefinition = {
  label: "기타",
  aliases: ["미분류", "기타행사"],
};
