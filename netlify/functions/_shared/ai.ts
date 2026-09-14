import Anthropic from "@anthropic-ai/sdk";

export const MODEL_ID = "claude-sonnet-5";
export const MAX_ONBOARDING_TURNS = 4;

export function readEnv(name: string): string | undefined {
  const netlify = (
    globalThis as { Netlify?: { env?: { get?: (key: string) => string | undefined } } }
  ).Netlify;
  const fromNetlify = netlify?.env?.get?.(name);
  if (fromNetlify) return fromNetlify;

  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

export function createAnthropic(): Anthropic {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

export function textFromContent(content: Anthropic.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function firstToolUse(content: Anthropic.Message["content"]): Anthropic.ToolUseBlock | null {
  const block = content.find((item): item is Anthropic.ToolUseBlock => item.type === "tool_use");
  return block ?? null;
}

export function parseModelJson<T>(raw: string, guard: (value: unknown) => value is T): T {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model did not return JSON");
  }

  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (!guard(parsed)) {
    throw new Error("Parsed JSON does not match expected schema");
  }
  return parsed;
}
