import type Anthropic from "@anthropic-ai/sdk";
import type { OnboardingChatMessage } from "../../src/lib/types.ts";
import { createAnthropic, firstToolUse, MAX_ONBOARDING_TURNS, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  askClarifyingTool,
  buildAnswerSystem,
  isClarifyingPayload,
  isLockPayload,
  lockClubProfileTool,
} from "./_shared/onboarding.ts";
import {
  currentAcademicYear,
  isRecord,
  isRoleDefinition,
  lockClubProfile,
  normalizeQuestions,
  normalizeRole,
} from "./_shared/schema.ts";

type AnswerBody = {
  text?: unknown;
  club_name?: unknown;
  academic_year?: unknown;
  draft_roles?: unknown;
  messages?: unknown;
  turn?: unknown;
};

function isChatMessage(value: unknown): value is OnboardingChatMessage {
  if (!isRecord(value)) return false;
  return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
}

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

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const clubName = typeof body.club_name === "string" ? body.club_name.trim() : "동아리";
  const currentYear = currentAcademicYear();
  const draftRoles = Array.isArray(body.draft_roles) ? body.draft_roles.filter(isRoleDefinition) : [];
  const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
  const turn = typeof body.turn === "number" && body.turn > 0 ? Math.floor(body.turn) : 1;

  if (!text) return errorResponse("Missing text", 400);
  if (draftRoles.length === 0) return errorResponse("Missing draft_roles", 400);
  if (messages.length === 0) return errorResponse("Missing messages", 400);

  const forceLock = turn >= MAX_ONBOARDING_TURNS;

  try {
    const client = createAnthropic();
    const conversation: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          `매뉴얼:\n${text}`,
          `현재 부서 초안: ${JSON.stringify(draftRoles)}`,
          `추정 동아리명: ${clubName}`,
          `현재 학년도: ${currentYear} (문서의 과거 연도는 무시)`,
          forceLock
            ? "이번이 마지막 턴이다. 더 묻지 말고 lock_club_profile으로 부서표를 확정하라."
            : "정보가 충분하면 잠그고, 아니면 선택지 버튼이 있는 질문만 1~2개 하라.",
        ].join("\n\n"),
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: buildAnswerSystem(currentYear),
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

    if (tool.name === "lock_club_profile" || forceLock) {
      if (!isLockPayload(tool.input)) {
        return errorResponse("Model did not return a valid ClubProfile", 500);
      }
      const profile = lockClubProfile({
        club_name: tool.input.club_name || clubName,
        academic_year: currentYear,
        roles: tool.input.roles,
        default_role: tool.input.default_role,
        locked: true,
      });
      return json(200, {
        ok: true,
        status: "locked",
        profile,
        assistant_message: tool.input.message.trim(),
        turn,
      });
    }

    if (tool.name !== "ask_clarifying_questions" || !isClarifyingPayload(tool.input)) {
      return errorResponse("Model did not return valid clarifying questions", 500);
    }

    return json(200, {
      ok: true,
      status: "clarifying",
      draft_roles: tool.input.draft_roles.map(normalizeRole),
      questions: normalizeQuestions(tool.input.questions),
      assistant_message: tool.input.message.trim(),
      turn,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
