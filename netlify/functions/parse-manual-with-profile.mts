import type Anthropic from "@anthropic-ai/sdk";
import { clubGenreLabel, type ClubData, type ClubGenre, type ClubProfile } from "../../src/lib/types.ts";
import { createAnthropic, firstToolUse, MODEL_ID, parseLooseJson, textFromContent } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  buildManualUserContent,
  hasManualContent,
  resolveManualInput,
  sliceManualForMonths,
  withManualText,
  type ResolvedManual,
} from "./_shared/manual-file.ts";
import { coerceClubData, constrainClubData, isClubProfile, lockClubProfile, parseClubGenre } from "./_shared/schema.ts";

type ParseBody = {
  text?: unknown;
  file?: unknown;
  profile?: unknown;
  months?: unknown;
  genre?: unknown;
};

const extractClubPlanTool: Anthropic.Tool = {
  name: "extract_club_plan",
  description: "잠긴 부서표를 지키며 지정한 월의 행사와 TO-DO를 추출한다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["club_info", "events"],
    properties: {
      club_info: {
        type: "object",
        additionalProperties: false,
        required: ["club_name", "academic_year", "roles"],
        properties: {
          club_name: { type: "string" },
          academic_year: { type: "number" },
          club_genre: { type: "string" },
          roles: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["role_name"],
              properties: {
                role_name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["event_id", "event_name", "category", "target_month", "tasks"],
          properties: {
            event_id: { type: "string" },
            event_name: { type: "string" },
            category: { type: "string" },
            target_month: { type: "number" },
            target_week: { type: "string" },
            event_date: { type: "string" },
            location: { type: "string" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["task_name", "days_before_dday", "assigned_role", "is_mandatory"],
                properties: {
                  task_id: { type: "string" },
                  task_name: { type: "string" },
                  days_before_dday: { type: "number" },
                  assigned_role: { type: "string" },
                  is_mandatory: { type: "boolean" },
                  action_details: { type: "string" },
                  checklist: { type: "array", items: { type: "string" } },
                  source: { type: "string", enum: ["extracted", "inferred"] },
                },
              },
            },
          },
        },
      },
      monthly_timelines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["month", "monthly_focus"],
          properties: {
            month: { type: "number" },
            monthly_focus: { type: "string" },
          },
        },
      },
    },
  },
};

function parseMonths(value: unknown): number[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error("Invalid months");
  const months = [
    ...new Set(
      value.filter(
        (item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 12,
      ),
    ),
  ].sort((a, b) => a - b);
  if (months.length === 0) throw new Error("Invalid months");
  return months;
}

function applyMonthFilter(data: ClubData, months: number[] | null): ClubData {
  if (!months) return data;
  const allowed = new Set(months);
  return {
    ...data,
    events: data.events.filter((event) => allowed.has(event.target_month)),
    ...(data.monthly_timelines
      ? { monthly_timelines: data.monthly_timelines.filter((item) => allowed.has(item.month)) }
      : {}),
    ...(data.gifts_and_anniversaries
      ? { gifts_and_anniversaries: data.gifts_and_anniversaries.filter((item) => allowed.has(item.target_month)) }
      : {}),
  };
}

function buildSystemPrompt(profile: ClubProfile, currentYear: number, months: number[] | null, genre: ClubGenre): string {
  const roleLines = profile.roles
    .map((role) => {
      const aliases = role.aliases.length > 0 ? ` (별칭: ${role.aliases.join(", ")})` : "";
      return `- ${role.role_name}${aliases}`;
    })
    .join("\n");
  const categoryLines = profile.categories
    .map((item) => {
      const aliases = item.aliases.length > 0 ? ` (별칭: ${item.aliases.join(", ")})` : "";
      return `- ${item.label}${aliases}`;
    })
    .join("\n");
  const monthRule = months
    ? `- 반드시 target_month가 ${months.join(", ")}월인 행사만 추출하라. 다른 월 행사는 생략하라.
- 문서에 한 번만 나온 행사는 한 번만 추출하라. 같은 행사를 학기마다 복제하지 마라.
- 날짜가 없는 행사는 이 구간의 전형에 맞을 때만 넣고, 아니면 생략하라.
  · 12–2월: 동계 MT, 겨울 워크숍, 신임 임원, 봄 모집 준비
  · 3–5월: 봄 신입 모집, OT, 면접, 학기 초 행사
  · 6–8월: 여름 MT, 해커톤, 워크숍, 봉사
  · 9–11월: 가을 모집, 정기공연, 연합, 뒷풀이, 졸업`
    : `- 문서에 있는 연간 행사를 빠짐없이 추출하라.
- 문서에 한 번만 나온 행사는 한 번만 넣어라. 학기마다 OT·해커톤을 복제하지 마라.
- 월이 없으면 단서로 한 번만 추정하고, 같은 이름을 여러 월에 넣지 마라.`;
  const genreLabel = clubGenreLabel(genre);

  return `너는 동아리 인수인계 매뉴얼에서 연간 일정과 세부 TO-DO를 추출하는 오퍼레이션 파서다.

현재 학년도는 ${currentYear}년이다. 매뉴얼에 과거 연도가 적혀 있어도 모든 일정과 academic_year는 ${currentYear}년을 기준으로 계산하라.

고정된 부서표(ClubProfile)가 이미 잠겨 있다. 이 제약을 절대 위반하지 마라.
- 담당자(assigned_role)는 반드시 아래 role_name 중에서만 선택하라. 이외 직책을 절대로 생성하지 마라.
- 문서에 회장/부회장/총무 등 목록 밖 직책이 나와도 새 역할을 만들지 말고 default_role을 사용하라.
- 별칭이 있으면 해당 role_name으로 정규화하라.
- 담당자가 없으면 default_role="${profile.default_role}"를 넣어라.
- 행사 category는 반드시 아래 잠긴 분류 label 중에서만 선택하라. 새 분류를 만들지 마라.
- 별칭이 있으면 해당 label로 정규화하라. 없으면 default_category="${profile.default_category}"를 넣어라.
${monthRule}
- 지정한 월 구간에 해당하지 않으면 억지로 끼워 넣지 마라. 그때는 events를 빈 배열로 두라.
- 한 번의 모임은 하나의 ClubEvent다. 같은 글의 파티·바베큐·꾸미기·뒷풀이는 쪼개지 마라.
- OT·해커톤처럼 원문에서 분명히 다른 행사인 경우만 각각 별도의 ClubEvent로 둔다.
- 장소 예약·대관·공지·정산·인원 조사는 그 행사의 task다. 별도 행사로 만들지 마라.
- 같은 행사를 이름만 살짝 바꿔 두 번 넣지 마라. 예: "종강 파티"와 "종강 파티 장소 예약"은 하나다.
- 같은 준비 TO-DO를 표현만 바꿔 두 번 쓰지 마라. 괄호 안 상세는 기존 항목에 합쳐라.
- 원문 일정을 우선 추출하라. 원문에 있는 내용은 추측으로 덮어쓰지 마라.
- 행사명만 있고 준비 TO-DO가 거의 없으면 장르(${genreLabel})의 핵심 준비만 보충하라.
- 원문에서 온 항목은 source "extracted", 보충 항목은 source "inferred"로 표시하라.

허용 role_name:
${roleLines}

허용 행사 분류:
${categoryLines}

기본 역할: ${profile.default_role}
기본 분류: ${profile.default_category}
동아리명: ${profile.club_name}
학년도: ${currentYear}
장르: ${genreLabel}

그 외 규칙:
- 반드시 extract_club_plan 도구만 호출하라.
- 스쿠버다이빙·특정 종목 용어에 종속되지 마라. 입력 텍스트에 적힌 행사명, 장소, 절차를 그대로 추출한다. category는 잠긴 분류만 쓴다.
- 가장 중요한 필드는 days_before_dday 이다. 행사일(D-Day) 기준 며칠 전에 수행해야 하는지를 나타내는 양의 정수다. 당일 수행은 0.
- 날짜가 모호해도 역질문하지 말고, 텍스트에 있는 단서만으로 최대한 채운다. 없는 필드는 생략한다.

필드 의미:
- ClubEvent.event_id: 영문/숫자/언더스코어 슬러그. 같은 행사에 월을 붙여 복제하지 마라.
- ClubEvent.category: 잠긴 ClubProfile.categories.label 또는 default_category만
- ClubEvent.target_month: 1~12
- ClubTask.assigned_role: 잠긴 ClubProfile.roles.role_name 또는 default_role만
- ClubTask.days_before_dday: 0 이상의 정수. 음수 금지
- ClubTask.is_mandatory: 필수 업무면 true
- ClubTask.source: extracted 또는 inferred
- club_info.roles: 잠긴 ClubProfile.roles와 동일해야 한다`;
}

function parseClubData(response: Anthropic.Message): ClubData {
  const tool = firstToolUse(response.content);
  if (tool && tool.name === "extract_club_plan") {
    const fromTool = coerceClubData(tool.input);
    if (fromTool) return fromTool;
  }
  const raw = textFromContent(response.content);
  if (raw) {
    try {
      const fromText = coerceClubData(parseLooseJson(raw));
      if (fromText) return fromText;
    } catch {
      // fall through
    }
  }
  throw new Error("일정을 읽지 못했습니다. 다시 추출해 주세요.");
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: ParseBody;
  try {
    body = await readJsonBody<ParseBody>(req);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  let months: number[] | null;
  try {
    months = parseMonths(body.months);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 400);
  }

  let resolved: ResolvedManual;
  try {
    resolved = await resolveManualInput(body.text, body.file);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 400);
  }
  if (!hasManualContent(resolved)) return errorResponse("Missing text", 400);
  if (!isClubProfile(body.profile)) return errorResponse("Invalid ClubProfile", 400);
  if (!body.profile.locked) return errorResponse("ClubProfile is not locked", 400);

  const currentYear = new Date().getFullYear();
  const profile = lockClubProfile({ ...body.profile, academic_year: currentYear });
  const genre = parseClubGenre(body.genre);
  const monthHint = months ? `${months.join(", ")}월 행사만` : "연간 일정과 TO-DO를";
  const forModel = withManualText(resolved, sliceManualForMonths(resolved.text, months));

  try {
    const client = createAnthropic();
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: months && months.length === 1 ? 4096 : 8192,
      system: buildSystemPrompt(profile, currentYear, months, genre),
      tools: [extractClubPlanTool],
      tool_choice: { type: "tool", name: "extract_club_plan" },
      messages: [
        {
          role: "user",
          content: buildManualUserContent(
            `현재 학년도는 ${currentYear}년이다. 잠긴 부서표와 행사 분류를 지키면서 ${monthHint} 추출하라. assigned_role은 허용 역할, category는 허용 분류 중에서만 지정하라. 원문 우선, 준비 TO-DO가 비면 장르(${clubGenreLabel(genre)}) 핵심만 source inferred로 보충하라.`,
            forModel,
          ),
        },
      ],
    });

    const data = applyMonthFilter(constrainClubData(parseClubData(response), profile, genre), months);
    return json(200, { ok: true, data, profile });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
