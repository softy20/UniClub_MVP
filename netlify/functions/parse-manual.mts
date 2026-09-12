import Anthropic from "@anthropic-ai/sdk";
import type { ClubData, ClubEvent, ClubTask } from "../../src/lib/types.ts";

const MODEL_ID = "claude-sonnet-5";

const SYSTEM_PROMPT = `너는 동아리 인수인계 매뉴얼에서 연간 일정과 세부 TO-DO를 추출하는 오퍼레이션 파서다.

규칙은 다음과 같다.
- 출력은 반드시 순수 JSON 객체 하나만 반환한다. 마크다운, 코드펜스, 설명 문장을 절대 포함하지 마라.
- 스쿠버다이빙·특정 종목 용어에 종속되지 마라. 입력 텍스트에 적힌 카테고리, 역할, 행사명, 장소, 절차를 그대로 추출한다.
- 가장 중요한 필드는 days_before_dday 이다. 행사일(D-Day) 기준 며칠 전에 수행해야 하는지를 나타내는 양의 정수다. 예: D-14는 14. 당일 수행은 0.
- 날짜나 역할이 모호해도 역질문하지 말고, 텍스트에 있는 단서만으로 최대한 채운다. 없는 필드는 생략한다.

출력 JSON은 아래 스키마를 따른다.
{
  "club_info": {
    "club_name": string,
    "academic_year": number,
    "club_genre": string | optional,
    "roles": [{ "role_name": string, "description": string | optional }]
  },
  "events": [
    {
      "event_id": string,
      "event_name": string,
      "category": string,
      "target_month": number,
      "target_week": string | optional,
      "event_date": string | optional,
      "location": string | optional,
      "tasks": [
        {
          "task_id": string | optional,
          "task_name": string,
          "days_before_dday": number,
          "assigned_role": string,
          "is_mandatory": boolean,
          "action_details": string | optional,
          "checklist": string[] | optional
        }
      ]
    }
  ],
  "gifts_and_anniversaries": optional,
  "monthly_timelines": [{ "month": number, "monthly_focus": string }] | optional
}

필드 의미:
- ClubEvent.event_id: 영문/숫자/언더스코어 슬러그 (예: evt_recruitment)
- ClubEvent.category: 입력 텍스트의 행사 성격 그대로 (예: 정기행사, 신입모집, MT/친목)
- ClubEvent.target_month: 1~12
- ClubTask.assigned_role: 입력 텍스트의 역할명 그대로
- ClubTask.days_before_dday: 양의 정수 또는 당일 0. 음수 금지
- ClubTask.is_mandatory: 필수 업무면 true`;

type ParseManualBody = {
  text?: unknown;
};

type ClubTaskShape = Pick<
  ClubTask,
  "task_name" | "days_before_dday" | "assigned_role" | "is_mandatory"
>;
type ClubEventShape = Pick<ClubEvent, "event_id" | "event_name" | "category" | "target_month" | "tasks">;

function readEnv(name: string): string | undefined {
  const netlify = (
    globalThis as { Netlify?: { env?: { get?: (key: string) => string | undefined } } }
  ).Netlify;
  const fromNetlify = netlify?.env?.get?.(name);
  if (fromNetlify) return fromNetlify;

  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function json(status: number, payload: unknown): Response {
  return Response.json(payload, { status });
}

function errorResponse(message: string, status = 500): Response {
  return json(status, { ok: false, error: message });
}

function textFromContent(content: Anthropic.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function parseModelJson(raw: string): ClubData {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model did not return JSON");
  }

  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (!isClubData(parsed)) {
    throw new Error("Parsed JSON does not match ClubEvent/ClubTask schema");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isClubData(value: unknown): value is ClubData {
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

export default async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: ParseManualBody;
  try {
    body = (await req.json()) as ParseManualBody;
  } catch {
    return errorResponse("Invalid JSON body", 500);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return errorResponse("Missing text", 500);
  }

  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return errorResponse("ANTHROPIC_API_KEY is not set", 500);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `다음 동아리 매뉴얼 텍스트에서 연간 일정과 TO-DO를 추출하라.\n\n${text}`,
        },
      ],
    });

    const raw = textFromContent(response.content);
    const data = parseModelJson(raw);
    return json(200, { ok: true, data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
