import { createAnthropic, firstToolUse, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  buildManualUserContent,
  excerptForOnboarding,
  hasManualContent,
  resolveManualInput,
  withManualText,
  type ResolvedManual,
} from "./_shared/manual-file.ts";
import { buildStartSystem, isDraftRolesPayload, proposeClubRolesTool } from "./_shared/onboarding.ts";
import {
  currentAcademicYear,
  ensureDraftCategories,
  ensureDraftRoles,
  normalizeCategory,
  normalizeQuestions,
  normalizeRole,
  parseManualImportDepth,
  withCategoriesQuestion,
  withClubNameQuestion,
  withEmptyRolesQuestion,
} from "./_shared/schema.ts";

type StartBody = {
  text?: unknown;
  file?: unknown;
  depth?: unknown;
};

/**
 * 온보딩 첫 턴을 처리하는 Netlify 함수 핸들러. 업로드된 매뉴얼(텍스트 또는 파일)에서
 * 부서/직책 초안과 행사 분류 초안, 확인 질문 1~2개를 모델로 뽑아 반환한다.
 * 특이사항: 동아리 이름이 모호하거나(withClubNameQuestion) 부서/분류 초안이 비어 있으면
 * (withEmptyRolesQuestion, withCategoriesQuestion) 관련 확인 질문을 자동으로 끼워 넣는다.
 */
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

  let resolved: ResolvedManual;
  try {
    resolved = await resolveManualInput(body.text, body.file);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 400);
  }
  if (!hasManualContent(resolved)) {
    return errorResponse("Missing text", 400);
  }

  const currentYear = currentAcademicYear();
  const depth = parseManualImportDepth(body.depth);

  try {
    const client = createAnthropic();
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: buildStartSystem(currentYear, depth),
      tools: [proposeClubRolesTool],
      tool_choice: { type: "tool", name: "propose_club_roles" },
      messages: [
        {
          role: "user",
          content: buildManualUserContent(
            `현재 학년도는 ${currentYear}년이다. 다음 매뉴얼에서 부서 초안, 행사 분류 초안, 선택지 버튼이 있는 확인 질문 1~2개를 추출하라.`,
            withManualText(resolved, excerptForOnboarding(resolved.text)),
          ),
        },
      ],
    });

    const tool = firstToolUse(response.content);
    if (!tool || !isDraftRolesPayload(tool.input)) {
      return errorResponse("Model did not return a valid role draft", 500);
    }

    const clubName = tool.input.club_name.trim() || "동아리";
    const draftRoles = ensureDraftRoles(tool.input.draft_roles.map(normalizeRole));
    const draftCategories = ensureDraftCategories(
      (tool.input.draft_categories ?? []).map(normalizeCategory),
    );
    const questions = withCategoriesQuestion(
      draftCategories,
      withEmptyRolesQuestion(
        draftRoles,
        withClubNameQuestion(clubName, normalizeQuestions(tool.input.questions)),
      ),
    );
    if (questions.length === 0) {
      return errorResponse("Model did not return clarifying questions", 500);
    }

    return json(200, {
      ok: true,
      club_name: clubName,
      academic_year: currentYear,
      draft_roles: draftRoles,
      draft_categories: draftCategories,
      questions,
      assistant_message: tool.input.message.trim(),
      text: resolved.text,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
