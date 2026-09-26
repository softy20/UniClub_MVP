import Anthropic from "@anthropic-ai/sdk";

export const MODEL_ID = "claude-sonnet-5";
export const MAX_ONBOARDING_TURNS = 4;

/**
 * 환경변수를 읽는다. Netlify 런타임의 `Netlify.env.get`을 먼저 시도하고, 없으면 Node의
 * `process.env`로 폴백한다.
 * @param name - 환경변수 이름
 * @returns 환경변수 값. 어디에도 없으면 undefined
 */
export function readEnv(name: string): string | undefined {
  const netlify = (
    globalThis as { Netlify?: { env?: { get?: (key: string) => string | undefined } } }
  ).Netlify;
  const fromNetlify = netlify?.env?.get?.(name);
  if (fromNetlify) return fromNetlify;

  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

/**
 * ANTHROPIC_API_KEY 환경변수로 Anthropic 클라이언트를 생성한다.
 * 특이사항: 키가 없으면 예외를 던진다.
 */
export function createAnthropic(): Anthropic {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

/**
 * 모델 응답 content 블록들 중 텍스트 블록만 골라 하나의 문자열로 합친다.
 */
export function textFromContent(content: Anthropic.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * 모델 응답 content에서 첫 번째 tool_use 블록을 찾는다.
 * @returns tool_use 블록. 없으면 null
 */
export function firstToolUse(content: Anthropic.Message["content"]): Anthropic.ToolUseBlock | null {
  const block = content.find((item): item is Anthropic.ToolUseBlock => item.type === "tool_use");
  return block ?? null;
}

/**
 * 모델 출력이 토큰 한도 등으로 중간에 잘려 완전한 JSON이 아닐 때, 마지막 미완성 문자열
 * 필드를 잘라내고 열려 있는 중괄호/대괄호를 닫아 파싱을 시도한다.
 * @returns 복구에 성공하면 파싱된 값, 실패하면 null
 * 특이사항: 문자열 리터럴이 닫히지 않은 채 끝나는 등 복구 불가능한 경우 null을 반환한다.
 */
function repairTruncatedJson(raw: string): unknown | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let slice = raw.slice(start).replace(/,?\s*"[^"\\]*(?:\\.[^"\\]*)*$/, "").replace(/,\s*$/, "");
  const closers: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of slice) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }
  if (inString) return null;
  while (closers.length > 0) slice += closers.pop();
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/**
 * 모델이 반환한 원문에서 코드펜스(```json)를 제거하고 첫 `{`~마지막 `}` 구간을 JSON으로
 * 파싱한다. 그대로 파싱이 안 되면 {@link repairTruncatedJson}으로 잘린 JSON 복구를 시도한다.
 * 특이사항: 둘 다 실패하면 사용자에게 보여줄 한국어 에러 메시지를 던진다.
 */
export function parseLooseJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through to repair
    }
  }
  const repaired = repairTruncatedJson(stripped);
  if (repaired !== null) return repaired;
  throw new Error("일정을 읽지 못했습니다. 다시 추출해 주세요.");
}

/**
 * 모델 출력 문자열을 {@link parseLooseJson}으로 파싱한 뒤 타입 가드로 형태를 검증한다.
 * @param guard - 파싱된 값이 T 형태인지 확인하는 타입 가드
 * 특이사항: 가드를 통과하지 못하면 형식 불일치 에러를 던진다.
 */
export function parseModelJson<T>(raw: string, guard: (value: unknown) => value is T): T {
  const parsed = parseLooseJson(raw);
  if (!guard(parsed)) {
    throw new Error("추출 결과가 일정 형식과 맞지 않습니다. 다시 추출해 주세요.");
  }
  return parsed;
}
