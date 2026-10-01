/**
 * 🧭 UniClub - constants (매뉴얼 가져오기 상수 모음)
 *
 * 운영 매뉴얼 마법사(ManualImportWizard)와 일정 추출 훅이 함께 쓰는 상수를 모아둔 파일입니다.
 *
 * 📌 주요 기능:
 * - 확인 질문 최대 턴 수(MAX_TURNS)와 질문 종류별 한글 라벨(CATEGORY_LABEL)
 * - 일정 추출 구간 설정: 계절 구간(PARSE_SEASONS), 상/하반기(PARSE_HALVES), 진행률 계산용 값
 * - 시간 초과 에러 문구, 짧은 매뉴얼 기준 글자 수, 기본 부서/분류(FALLBACK_ROLE/CATEGORY)
 *
 * 🔗 사용 예시:
 * ```ts
 * import { MAX_TURNS, PARSE_SEASONS } from "./constants";
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 모든 값은 export된 const입니다.
 * - 의존성: ../../lib/types, ./types
 *
 * 💡 팁 및 주의사항:
 * - PARSE_CHUNK_TOTAL은 PARSE_SEASONS 길이에서 계산되므로, 계절 구간을 바꾸면 진행률 계산도 자동으로 따라갑니다.
 * - PARSE_CHUNK_MS, PARSE_FINISH_MS는 진행률 애니메이션의 체감용 시간이며 실제 서버 응답 시간과는 무관합니다.
 *
 * @file constants.ts
 * @module components/manual-import/constants
 */
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
