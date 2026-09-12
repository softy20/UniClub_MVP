import { createAnthropic, firstToolUse, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { isDraftRolesPayload, proposeClubRolesTool, START_SYSTEM } from "./_shared/onboarding.ts";
import { normalizeRole } from "./_shared/schema.ts";

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

  try {
    const client = createAnthropic();
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: START_SYSTEM,
      tools: [proposeClubRolesTool],
      tool_choice: { type: "tool", name: "propose_club_roles" },
      messages: [
        {
          role: "user",
          content: `다음 매뉴얼에서 부서 초안과 확인 질문 1~2개를 추출하라.\n\n${text}`,
        },
      ],
    });

    const tool = firstToolUse(response.content);
    if (!tool || !isDraftRolesPayload(tool.input)) {
      return errorResponse("Model did not return a valid role draft", 500);
    }

    return json(200, {
      ok: true,
      club_name: tool.input.club_name.trim() || "동아리",
      academic_year: tool.input.academic_year,
      draft_roles: tool.input.draft_roles.map(normalizeRole),
      questions: tool.input.questions,
      assistant_message: tool.input.message.trim(),
      text,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
