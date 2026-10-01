import type Anthropic from "@anthropic-ai/sdk";
import type { OnboardingChatMessage } from "../../src/lib/types.ts";
import { createAnthropic, firstToolUse, MAX_ONBOARDING_TURNS, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  buildManualUserContent,
  excerptForOnboarding,
  hasManualContent,
  resolveManualInput,
  withManualText,
  type ResolvedManual,
} from "./_shared/manual-file.ts";
import {
  askClarifyingTool,
  buildAnswerSystem,
  isClarifyingPayload,
  isLockPayload,
  lockClubProfileTool,
} from "./_shared/onboarding.ts";
import {
  COMMON_CATEGORY,
  currentAcademicYear,
  ensureDraftCategories,
  ensureDraftRoles,
  isCategoryDefinition,
  isRecord,
  isRoleDefinition,
  lockClubProfile,
  normalizeCategory,
  normalizeQuestions,
  normalizeRole,
  parseManualImportDepth,
  withCategoriesQuestion,
} from "./_shared/schema.ts";

type AnswerBody = {
  text?: unknown;
  file?: unknown;
  club_name?: unknown;
  academic_year?: unknown;
  draft_roles?: unknown;
  draft_categories?: unknown;
  categories_asked?: unknown;
  messages?: unknown;
  turn?: unknown;
  depth?: unknown;
};

/**
 * 값이 온보딩 대화 메시지(role: "user" | "assistant", content: string) 형태인지 검사한다.
 */
function isChatMessage(value: unknown): value is OnboardingChatMessage {
  if (!isRecord(value)) return false;
  return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
}

/**
 * 온보딩 후속 턴을 처리하는 Netlify 함수 핸들러. 지금까지의 부서/분류 초안과 대화 내역을
 * 모델에 다시 보내, 아직 정보가 부족하면 확인 질문을(status "clarifying"), 충분하면 부서표를
 * 확정한 ClubProfile을(status "locked") 반환한다.
 * 특이사항: MAX_ONBOARDING_TURNS에 도달하면 forceLock으로 lock_club_profile 도구 호출을
 * 강제한다. 행사 분류를 아직 확인하지 않았으면(categories_asked=false) lock 대신 분류
 * 확인 질문을 우선 끼워 넣는다. 모델이 부서 없이 잠그려 하면(roles가 비거나 정보 부족)
 * "공통" 역할로 채운 fallbackLock으로 대체한다.
 */
export default async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: AnswerBody;
  try {
    body = await readJsonBody<AnswerBody>(req);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  let resolved: ResolvedManual;
  try {
    resolved = await resolveManualInput(body.text, body.file);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 400);
  }
  if (!hasManualContent(resolved)) return errorResponse("Missing text", 400);

  const clubName = typeof body.club_name === "string" ? body.club_name.trim() : "동아리";
  const currentYear = currentAcademicYear();
  const draftRoles = ensureDraftRoles(
    Array.isArray(body.draft_roles) ? body.draft_roles.filter(isRoleDefinition) : [],
  );
  const draftCategories = ensureDraftCategories(
    Array.isArray(body.draft_categories) ? body.draft_categories.filter(isCategoryDefinition) : [],
  );
  const categoriesAsked = body.categories_asked === true;
  const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
  const turn = typeof body.turn === "number" && body.turn > 0 ? Math.floor(body.turn) : 1;
  const depth = parseManualImportDepth(body.depth);

  if (messages.length === 0) return errorResponse("Missing messages", 400);

  const forceLock = turn >= MAX_ONBOARDING_TURNS;

  try {
    const client = createAnthropic();
    const conversation: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: buildManualUserContent(
          [
            resolved.pdf ? "첨부 PDF 매뉴얼을 기준으로 부서표를 확정하라." : "아래 매뉴얼을 기준으로 부서표를 확정하라.",
            `현재 부서 초안: ${JSON.stringify(draftRoles)}`,
            `현재 행사 분류 초안: ${JSON.stringify(draftCategories)}`,
            `추정 동아리명: ${clubName}`,
            `현재 학년도: ${currentYear} (문서의 과거 연도는 무시)`,
            forceLock
              ? "이번이 마지막 턴이다. 더 묻지 말고 lock_club_profile으로 부서표와 행사 분류를 확정하라. roles가 비면 공통만, categories가 비면 기타만 넣어라."
              : categoriesAsked
                ? "행사 분류는 이미 확인했다. 부서 없이 진행/공통/사적 모임이면 즉시 잠그고 roles는 공통만 둔다. 정보가 충분하면 잠그고, 아니면 선택지 질문만 1~2개 하라."
                : "행사 분류를 아직 확인하지 않았다. lock하지 말고 event_categories 질문을 포함하라. 부서 없이 진행이어도 분류는 확인한 뒤 잠근다.",
          ].join("\n\n"),
          withManualText(resolved, excerptForOnboarding(resolved.text)),
        ),
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: buildAnswerSystem(currentYear, depth),
      tools: [askClarifyingTool, lockClubProfileTool],
      tool_choice: forceLock
        ? { type: "tool", name: "lock_club_profile" }
        : { type: "any" },
      messages: conversation,
    });

    const tool = firstToolUse(response.content);
    if (!tool) {
      return errorResponse("Model did not call an onboarding tool", 500);
    }

    if ((tool.name === "lock_club_profile" || forceLock) && (forceLock || categoriesAsked)) {
      const fallbackLock = {
        club_name: clubName,
        academic_year: currentYear,
        roles: draftRoles,
        default_role: "공통",
        categories: draftCategories,
        default_category: COMMON_CATEGORY.label,
        message: "역할이 없어 공통으로 잠갔습니다. 나중에 부서를 나눌 수 있습니다.",
      };
      const raw = isLockPayload(tool.input) ? tool.input : fallbackLock;
      const profile = lockClubProfile({
        club_name: raw.club_name || clubName,
        academic_year: currentYear,
        roles: ensureDraftRoles(raw.roles.map(normalizeRole)),
        default_role: raw.default_role || "공통",
        categories: ensureDraftCategories((raw.categories ?? draftCategories).map(normalizeCategory)),
        default_category: raw.default_category || COMMON_CATEGORY.label,
        locked: true,
      });
      return json(200, {
        ok: true,
        status: "locked",
        profile,
        assistant_message: raw.message.trim(),
        turn,
      });
    }

    const nextRoles =
      tool.name === "ask_clarifying_questions" && isClarifyingPayload(tool.input)
        ? ensureDraftRoles(tool.input.draft_roles.map(normalizeRole))
        : draftRoles;
    const nextCategories =
      tool.name === "ask_clarifying_questions" && isClarifyingPayload(tool.input)
        ? ensureDraftCategories((tool.input.draft_categories ?? []).map(normalizeCategory))
        : draftCategories;
    const modelQuestions =
      tool.name === "ask_clarifying_questions" && isClarifyingPayload(tool.input)
        ? normalizeQuestions(tool.input.questions)
        : [];
    const questions = withCategoriesQuestion(nextCategories, modelQuestions);
    if (questions.length === 0) {
      return errorResponse("Model did not return valid clarifying questions", 500);
    }

    return json(200, {
      ok: true,
      status: "clarifying",
      draft_roles: nextRoles,
      draft_categories: nextCategories,
      questions,
      assistant_message:
        tool.name === "ask_clarifying_questions" && isClarifyingPayload(tool.input)
          ? tool.input.message.trim()
          : "행사 분류를 확인해 주세요. 이후 일정 추출은 이 목록만 사용합니다.",
      turn,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
