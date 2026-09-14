import type Anthropic from "@anthropic-ai/sdk";
import type { OnboardingChatMessage } from "../../src/lib/types.ts";
import { createAnthropic, firstToolUse, MAX_ONBOARDING_TURNS, MODEL_ID } from "./_shared/ai.ts";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import {
  buildManualUserContent,
  hasManualContent,
  resolveManualInput,
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
  currentAcademicYear,
  ensureDraftRoles,
  isRecord,
  isRoleDefinition,
  lockClubProfile,
  normalizeQuestions,
  normalizeRole,
} from "./_shared/schema.ts";

type AnswerBody = {
  text?: unknown;
  file?: unknown;
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
  const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
  const turn = typeof body.turn === "number" && body.turn > 0 ? Math.floor(body.turn) : 1;

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
            `추정 동아리명: ${clubName}`,
            `현재 학년도: ${currentYear} (문서의 과거 연도는 무시)`,
            forceLock
              ? "이번이 마지막 턴이다. 더 묻지 말고 lock_club_profile으로 부서표를 확정하라. roles가 비면 공통만 넣어라."
              : "부서 없이 진행/공통/사적 모임이면 즉시 잠그고 roles는 공통만 둔다. 정보가 충분하면 잠그고, 아니면 선택지 질문만 1~2개 하라.",
          ].join("\n\n"),
          resolved,
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
      const fallbackLock = {
        club_name: clubName,
        academic_year: currentYear,
        roles: draftRoles,
        default_role: "공통",
        message: "역할이 없어 공통으로 잠갔습니다. 나중에 부서를 나눌 수 있습니다.",
      };
      const raw = isLockPayload(tool.input) ? tool.input : fallbackLock;
      const profile = lockClubProfile({
        club_name: raw.club_name || clubName,
        academic_year: currentYear,
        roles: ensureDraftRoles(raw.roles.map(normalizeRole)),
        default_role: raw.default_role || "공통",
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

    if (tool.name !== "ask_clarifying_questions" || !isClarifyingPayload(tool.input)) {
      return errorResponse("Model did not return valid clarifying questions", 500);
    }

    return json(200, {
      ok: true,
      status: "clarifying",
      draft_roles: ensureDraftRoles(tool.input.draft_roles.map(normalizeRole)),
      questions: normalizeQuestions(tool.input.questions),
      assistant_message: tool.input.message.trim(),
      turn,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};
