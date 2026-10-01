import type {
  CategoryDefinition,
  ClarifyingQuestion,
  ClubData,
  ClubEvent,
  ClubGenre,
  ClubProfile,
  QuestionOption,
  RoleDefinition,
} from "../../lib/types";
import { PARSE_HALVES, PARSE_SEASONS, PARSE_TIMEOUT_MESSAGE } from "./constants";
import type { ApiError, ParseHalf } from "./types";

/**
 * 서버 응답 본문(원문 문자열)에 시간 초과를 나타내는 문구가 들어 있는지 검사한다.
 * 특이사항: JSON 파싱이 안 되는 응답(예: 함수 런타임이 던진 순수 에러 텍스트)을 처리하기 위한 용도.
 */
export function isTimeoutBody(raw: string): boolean {
  return /TimeoutError|timed?\s*out/i.test(raw);
}

/**
 * 주어진 에러가 일정 파싱 시간 초과로 인한 것인지 판단한다.
 * 특이사항: 우리가 직접 던진 PARSE_TIMEOUT_MESSAGE 메시지와, 서버가 보낸 원문 시간 초과 문구를 모두 확인한다.
 */
export function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === PARSE_TIMEOUT_MESSAGE || isTimeoutBody(message);
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * 브라우저가 화면을 한 번 그릴 때까지 기다린다.
 * 특이사항: requestAnimationFrame을 두 번 중첩해서, 상태 변경(예: 진행률 100%)이 실제로
 * 화면에 반영된 뒤에 다음 동작(예: 미리보기 전환)을 이어가도록 한다.
 */
export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * 특정 반기(half)에서 이미 끝난(성공적으로 저장된) 월 구간 개수를 계산한다.
 * @returns 해당 반기가 지금 다시 파싱 중이면 0, 아니면(이미 완료된 반기면) 그 반기의 전체 구간 수
 */
export function settledChunkCount(half: ParseHalf, events: ClubEvent[] | null, running: ParseHalf[]): number {
  if (running.includes(half)) return 0;
  return events ? PARSE_HALVES[half].chunks.length : 0;
}

/**
 * 파싱 중인 월 구간(months)을 사용자에게 보여줄 라벨로 바꾼다.
 * @returns 미리 정의된 계절(PARSE_SEASONS)과 정확히 일치하면 그 계절 이름(예: "1학기(3–5월)"),
 * 아니면 "n월" 또는 "n–m월" 형태의 문자열
 */
export function formatParseStep(months: number[]): string {
  const found = PARSE_SEASONS.find(
    (season) => season.months.length === months.length && season.months.every((month, index) => month === months[index]),
  );
  if (found) return found.label;
  if (months.length === 1) return `${months[0]}월`;
  return `${months[0]}–${months[months.length - 1]}월`;
}

/**
 * 확정된 부서표(profile)와 추출된 일정(events)을 합쳐 저장/미리보기용 ClubData 형태로 만든다.
 * 특이사항: 역할 설명(description)이 빈 값이면 필드 자체를 넣지 않는다.
 */
export function clubDataFromProfile(profile: ClubProfile, events: ClubEvent[], genre: ClubGenre): ClubData {
  return {
    club_info: {
      club_name: profile.club_name,
      academic_year: profile.academic_year,
      club_genre: genre,
      roles: profile.roles.map((role) => ({
        role_name: role.role_name,
        ...(role.description ? { description: role.description } : {}),
      })),
    },
    events,
  };
}

/**
 * 역할(role)의 별칭 목록에서, 공백만 있거나 정식 이름과 똑같은 별칭을 제외한 "진짜 별칭"만 남긴다.
 */
export function extraAliases(role: RoleDefinition): string[] {
  return role.aliases.map((alias) => alias.trim()).filter((alias) => alias.length > 0 && alias !== role.role_name);
}

/**
 * 행사 분류(category)의 별칭 목록에서, 공백만 있거나 정식 라벨과 똑같은 별칭을 제외한다.
 */
export function extraCategoryAliases(category: CategoryDefinition): string[] {
  return category.aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0 && alias !== category.label);
}

export function isDeptQuestion(question: ClarifyingQuestion | undefined): boolean {
  return question?.category === "roles" || question?.category === "aliases";
}

export function isCategoryQuestion(question: ClarifyingQuestion | undefined): boolean {
  return question?.category === "event_categories";
}

/**
 * 선택지가 "직접 입력(기타)" 옵션인지 판단한다.
 * 특이사항: id가 "other"이거나 라벨에 "직접 입력"이 포함되면 무조건 기타로 보고, 그 외에는
 * is_other 플래그를 보되 라벨에 "기타로"가 들어간 경우(예: "기타로 분류")는 자유 입력이 아니므로 제외한다.
 */
export function isOtherOption(option: QuestionOption): boolean {
  if (option.id === "other" || option.label.includes("직접 입력")) return true;
  return option.is_other === true && !option.label.includes("기타로");
}

/**
 * 질문마다 답변을 구분해서 저장하기 위한 고유 키를 만든다.
 * 특이사항: 서버 응답에 따라 질문 순서/개수가 바뀌어도 같은 질문을 가리키도록 인덱스와
 * 카테고리를 함께 조합한다.
 */
export function questionKey(question: ClarifyingQuestion, index: number): string {
  return `${index}:${question.category}`;
}

/**
 * 확인 질문들에 대해 사용자가 고른 선택지(및 "기타" 직접 입력값)를 모아, 서버로 보낼
 * 하나의 답변 문자열로 합친다.
 * @returns 질문이 없으면 자유 입력값을, 있으면 "질문\n선택: ...(\n입력: ...)" 형태를 질문 순서대로
 * 이어붙인 문자열. 아직 답하지 않은 질문이 있거나(선택지 없음) "기타"인데 직접 입력이 비어 있으면 null.
 * 특이사항: 질문 하나라도 답이 미완성이면 전체를 null로 반환해서, 호출 쪽에서 "다 답해야 전송 가능"을
 * 강제하게 한다.
 */
export function composeAnswerFrom(
  questions: ClarifyingQuestion[],
  selectedByQuestion: Record<string, string>,
  otherByQuestion: Record<string, string>,
): string | null {
  if (questions.length === 0) {
    const only = Object.values(otherByQuestion).map((value) => value.trim()).find(Boolean);
    return only || null;
  }
  const parts: string[] = [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) return null;
    const key = questionKey(question, index);
    const selectedId = selectedByQuestion[key] ?? selectedByQuestion[question.question];
    const option = question.options.find((item) => item.id === selectedId);
    if (!option) return null;
    if (isOtherOption(option)) {
      const custom = (otherByQuestion[key] ?? otherByQuestion[question.question] ?? "").trim();
      if (!custom) return null;
      parts.push(`${question.question}\n선택: ${option.label}\n입력: ${custom}`);
      continue;
    }
    parts.push(`${question.question}\n선택: ${option.label}`);
  }
  return parts.join("\n\n");
}

/**
 * Netlify 함수(백엔드 API)에 JSON을 POST로 보내고 결과를 파싱해서 돌려준다.
 * @returns 서버가 보낸 성공 응답(JSON) 바디
 * 특이사항: 응답 본문이 JSON이 아니면(예: 함수 런타임이 순수 텍스트로 에러를 던진 경우) 시간 초과
 * 여부를 먼저 확인해 전용 에러 메시지를 던지고, HTTP 실패나 `{ ok: false }` 응답도 에러로 변환한다.
 * 이 파일의 모든 서버 통신(startOnboarding, sendAnswer, requestEvents 등)이 이 함수를 거친다.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: T | ApiError | undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw) as T | ApiError;
    } catch {
      if (isTimeoutBody(raw)) throw new Error(PARSE_TIMEOUT_MESSAGE);
      const preview = raw.slice(0, 80).trim();
      throw new Error(preview ? `요청 실패 (${response.status}): ${preview}` : `요청 실패 (${response.status})`);
    }
  }
  if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && payload.ok === false)) {
    const message = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    if (typeof message === "string" && isTimeoutBody(message)) {
      throw new Error(PARSE_TIMEOUT_MESSAGE);
    }
    throw new Error(message || `요청 실패 (${response.status})`);
  }
  if (!payload) throw new Error(`요청 실패 (${response.status})`);
  return payload as T;
}
