import { createAnthropic, firstToolUse, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { buildStartSystem, isDraftRolesPayload, proposeClubRolesTool } from "./_shared/onboarding.ts";
import { currentAcademicYear, normalizeQuestions, normalizeRole, withClubNameQuestion } from "./_shared/schema.ts";

type StartBody = {
  text?: unknown;
};

export default async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: StartBody;
  try {
    body = await readJsonBody<StartBody>(req);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return errorResponse("Missing text", 400);
  }

  const currentYear = currentAcademicYear();

  try {
    const client = createAnthropic();
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: buildStartSystem(currentYear),
      tools: [proposeClubRolesTool],
      tool_choice: { type: "tool", name: "propose_club_roles" },
      messages: [
        {
          role: "user",
          content: `현재 학년도는 ${currentYear}년이다. 다음 매뉴얼에서 부서 초안과 선택지 버튼이 있는 확인 질문 1~2개를 추출하라.\n\n${text}`,
        },
      ],
    });

    const tool = firstToolUse(response.content);
    if (!tool || !isDraftRolesPayload(tool.input)) {
      return errorResponse("Model did not return a valid role draft", 500);
    }

    const clubName = tool.input.club_name.trim() || "동아리";
    const questions = withClubNameQuestion(clubName, normalizeQuestions(tool.input.questions));
    if (questions.length === 0) {
      return errorResponse("Model did not return clarifying questions", 500);
    }

    return json(200, {
      ok: true,
      club_name: clubName,
      academic_year: currentYear,
      draft_roles: tool.input.draft_roles.map(normalizeRole),
      questions,
      assistant_message: tool.input.message.trim(),
      text,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
