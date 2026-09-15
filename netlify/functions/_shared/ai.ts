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

function repairTruncatedJson(raw: string): unknown | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let slice = raw.slice(start).replace(/,?\s*"[^"\\]*(?:\\.[^"\\]*)*$/, "").replace(/,\s*$/, "");
  const closers: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of slice) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }
  if (inString) return null;
  while (closers.length > 0) slice += closers.pop();
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export function parseLooseJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through to repair
    }
  }
  const repaired = repairTruncatedJson(stripped);
  if (repaired !== null) return repaired;
  throw new Error("일정을 읽지 못했습니다. 다시 추출해 주세요.");
}

export function parseModelJson<T>(raw: string, guard: (value: unknown) => value is T): T {
  const parsed = parseLooseJson(raw);
  if (!guard(parsed)) {
    throw new Error("추출 결과가 일정 형식과 맞지 않습니다. 다시 추출해 주세요.");
  }
  return parsed;
}
