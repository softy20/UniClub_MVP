import type { ClubProfile } from "../../src/lib/types.ts";
import { createAnthropic, MODEL_ID, parseModelJson, textFromContent } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { constrainClubData, currentAcademicYear, isClubData, isClubProfile, lockClubProfile } from "./_shared/schema.ts";

type ParseBody = {
  text?: unknown;
  profile?: unknown;
};

function buildSystemPrompt(profile: ClubProfile, currentYear: number): string {
  const roleLines = profile.roles
    .map((role) => {
      const aliases = role.aliases.length > 0 ? ` (별칭: ${role.aliases.join(", ")})` : "";
      return `- ${role.role_name}${aliases}`;
    })
    .join("\n");

  return `너는 동아리 인수인계 매뉴얼에서 연간 일정과 세부 TO-DO를 추출하는 오퍼레이션 파서다.

현재 학년도는 ${currentYear}년이다. 매뉴얼에 과거 연도가 적혀 있어도 모든 일정과 academic_year는 ${currentYear}년을 기준으로 계산하라.

고정된 부서표(ClubProfile)가 이미 잠겨 있다. 이 제약을 절대 위반하지 마라.
- 담당자(assigned_role)는 반드시 아래 role_name 중에서만 선택하라. 이외 직책을 절대로 생성하지 마라.
- 문서에 회장/부회장/총무 등 목록 밖 직책이 나와도 새 역할을 만들지 말고 default_role을 사용하라.
- 별칭이 있으면 해당 role_name으로 정규화하라.
- 담당자가 없으면 default_role="${profile.default_role}"를 넣어라.

허용 role_name:
${roleLines}

기본 역할: ${profile.default_role}
동아리명: ${profile.club_name}
학년도: ${currentYear}

그 외 규칙:
- 출력은 반드시 순수 JSON 객체 하나만 반환한다. 마크다운, 코드펜스, 설명 문장을 절대 포함하지 마라.
- 스쿠버다이빙·특정 종목 용어에 종속되지 마라. 입력 텍스트에 적힌 카테고리, 행사명, 장소, 절차를 그대로 추출한다.
- 가장 중요한 필드는 days_before_dday 이다. 행사일(D-Day) 기준 며칠 전에 수행해야 하는지를 나타내는 양의 정수다. 당일 수행은 0.
- 날짜가 모호해도 역질문하지 말고, 텍스트에 있는 단서만으로 최대한 채운다. 없는 필드는 생략한다.

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
- ClubEvent.event_id: 영문/숫자/언더스코어 슬러그
- ClubEvent.category: 입력 텍스트의 행사 성격 그대로
- ClubEvent.target_month: 1~12
- ClubTask.assigned_role: 잠긴 ClubProfile.roles.role_name 또는 default_role만
- ClubTask.days_before_dday: 0 이상의 정수. 음수 금지
- ClubTask.is_mandatory: 필수 업무면 true
- club_info.roles: 잠긴 ClubProfile.roles와 동일해야 한다`;
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

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return errorResponse("Missing text", 400);
  if (!isClubProfile(body.profile)) return errorResponse("Invalid ClubProfile", 400);
  if (!body.profile.locked) return errorResponse("ClubProfile is not locked", 400);

  const currentYear = currentAcademicYear();
  const profile = lockClubProfile({ ...body.profile, academic_year: currentYear });

  try {
    const client = createAnthropic();
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      system: buildSystemPrompt(profile, currentYear),
      messages: [
        {
          role: "user",
          content: `현재 학년도는 ${currentYear}년이다. 잠긴 부서표를 지키면서 다음 매뉴얼에서 연간 일정과 TO-DO를 추출하라.\n\n${text}`,
        },
      ],
    });

    const raw = textFromContent(response.content);
    const data = constrainClubData(parseModelJson(raw, isClubData), profile);
    return json(200, { ok: true, data, profile });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
