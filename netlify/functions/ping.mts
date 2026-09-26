import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = process.env.CLAUDE_MODEL_ID ?? "claude-sonnet-5";

/**
 * Anthropic API 연결을 확인하기 위한 헬스체크 핸들러. "ping" 메시지를 모델에 보내고
 * 응답을 그대로 반환한다.
 */
export default async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 32,
      messages: [{ role: "user", content: "ping" }],
    });

    return Response.json({ ok: true, reply: response });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
