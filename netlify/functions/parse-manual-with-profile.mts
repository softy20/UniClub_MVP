import type Anthropic from "@anthropic-ai/sdk";
import { clubGenreLabel, type ClubData, type ClubGenre, type ClubProfile } from "../../src/lib/types.ts";
import { createAnthropic, firstToolUse, MODEL_ID, parseModelJson, textFromContent } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  buildManualUserContent,
  hasManualContent,
  resolveManualInput,
  sliceManualForMonths,
  withManualText,
  type ResolvedManual,
} from "./_shared/manual-file.ts";
import { constrainClubData, isClubData, isClubProfile, lockClubProfile, parseClubGenre } from "./_shared/schema.ts";

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
  const monthRule = months
    ? `- 반드시 target_month가 ${months.join(", ")}월인 행사만 추출하라. 다른 월 행사는 생략하라.`
    : "- 문서에 있는 연간 행사를 추출하라.";
  const genreLabel = clubGenreLabel(genre);

  return `너는 동아리 인수인계 매뉴얼에서 연간 일정과 세부 TO-DO를 추출하는 오퍼레이션 파서다.

현재 학년도는 ${currentYear}년이다. 매뉴얼에 과거 연도가 적혀 있어도 모든 일정과 academic_year는 ${currentYear}년을 기준으로 계산하라.

고정된 부서표(ClubProfile)가 이미 잠겨 있다. 이 제약을 절대 위반하지 마라.
- 담당자(assigned_role)는 반드시 아래 role_name 중에서만 선택하라. 이외 직책을 절대로 생성하지 마라.
- 문서에 회장/부회장/총무 등 목록 밖 직책이 나와도 새 역할을 만들지 말고 default_role을 사용하라.
- 별칭이 있으면 해당 role_name으로 정규화하라.
- 담당자가 없으면 default_role="${profile.default_role}"를 넣어라.
${monthRule}
- 원문 일정을 우선 추출하라. 원문에 있는 내용은 추측으로 덮어쓰지 마라.
- 행사명만 있고 준비 TO-DO가 거의 없으면 장르(${genreLabel})의 핵심 준비만 보충하라.
- 원문에서 온 항목은 source "extracted", 보충 항목은 source "inferred"로 표시하라.

허용 role_name:
${roleLines}

기본 역할: ${profile.default_role}
동아리명: ${profile.club_name}
학년도: ${currentYear}
장르: ${genreLabel}

그 외 규칙:
- 반드시 extract_club_plan 도구만 호출하라.
- 스쿠버다이빙·특정 종목 용어에 종속되지 마라. 입력 텍스트에 적힌 카테고리, 행사명, 장소, 절차를 그대로 추출한다.
- 가장 중요한 필드는 days_before_dday 이다. 행사일(D-Day) 기준 며칠 전에 수행해야 하는지를 나타내는 양의 정수다. 당일 수행은 0.
- 날짜가 모호해도 역질문하지 말고, 텍스트에 있는 단서만으로 최대한 채운다. 없는 필드는 생략한다.

필드 의미:
- ClubEvent.event_id: 영문/숫자/언더스코어 슬러그
- ClubEvent.category: 입력 텍스트의 행사 성격 그대로
- ClubEvent.target_month: 1~12
- ClubTask.assigned_role: 잠긴 ClubProfile.roles.role_name 또는 default_role만
- ClubTask.days_before_dday: 0 이상의 정수. 음수 금지
- ClubTask.is_mandatory: 필수 업무면 true
- ClubTask.source: extracted 또는 inferred
- club_info.roles: 잠긴 ClubProfile.roles와 동일해야 한다`;
}

function parseClubData(response: Anthropic.Message): ClubData {
  const tool = firstToolUse(response.content);
  if (tool && tool.name === "extract_club_plan" && isClubData(tool.input)) {
    return tool.input;
  }
  return parseModelJson(textFromContent(response.content), isClubData);
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
      max_tokens: !months || months.length > 3 ? 8192 : months.length === 1 ? 2048 : 4096,
      system: buildSystemPrompt(profile, currentYear, months, genre),
      tools: [extractClubPlanTool],
      tool_choice: { type: "tool", name: "extract_club_plan" },
      messages: [
        {
          role: "user",
          content: buildManualUserContent(
            `현재 학년도는 ${currentYear}년이다. 잠긴 부서표를 지키면서 ${monthHint} 추출하라. assigned_role은 허용 역할 중에서만 지정하라. 원문 우선, 준비 TO-DO가 비면 장르(${clubGenreLabel(genre)}) 핵심만 source inferred로 보충하라.`,
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
