/**
 * 🧭 UniClub - types (매뉴얼 가져오기 타입 모음)
 *
 * 운영 매뉴얼 마법사와 서버(Netlify 함수) 응답에서 쓰는 타입을 모아둔 파일입니다.
 *
 * 📌 주요 기능:
 * - Phase: 마법사 단계(input / clarifying / locked / parsed)
 * - StartOk, AnswerOk, ParseOk: 서버 성공 응답 모양
 * - ApiError: 서버 에러 응답 모양, ParseHalf: 상반기/하반기 구분
 *
 * 🔗 사용 예시:
 * ```ts
 * import type { Phase, AnswerOk } from "./types";
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 모두 export된 type이며 런타임 코드는 없습니다.
 * - 의존성: ../../lib/types
 *
 * 💡 팁 및 주의사항:
 * - 서버 응답 모양을 바꾸면 netlify/functions 쪽과 이 타입을 함께 맞춰야 합니다.
 *
 * @file types.ts
 * @module components/manual-import/types
 */
import type {
  CategoryDefinition,
  ClarifyingQuestion,
  ClubData,
  ClubProfile,
  RoleDefinition,
} from "../../lib/types";

export type Phase = "input" | "clarifying" | "locked" | "parsed";

export type StartOk = {
  ok: true;
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  draft_categories: CategoryDefinition[];
  questions: ClarifyingQuestion[];
  assistant_message: string;
  text?: string;
};

export type AnswerOk =
  | {
    ok: true;
    status: "clarifying";
    draft_roles: RoleDefinition[];
    draft_categories: CategoryDefinition[];
    questions: ClarifyingQuestion[];
    assistant_message: string;
    turn: number;
  }
  | {
    ok: true;
    status: "locked";
    profile: ClubProfile;
    assistant_message: string;
    turn: number;
  };

export type ParseOk = {
  ok: true;
  data: ClubData;
};

export type ApiError = { ok?: false; error?: string };

export type ParseHalf = "first" | "second";
