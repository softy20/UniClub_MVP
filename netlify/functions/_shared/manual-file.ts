import type Anthropic from "@anthropic-ai/sdk";
import { monthHeadingHits } from "../../../src/lib/manual-months.ts";
import { isRecord } from "./schema.ts";

export const HWP_MESSAGE = "한글(.hwp) 파일은 워드(.docx)로 변환하여 업로드해 주세요";
export const MAX_MANUAL_FILE_BYTES = 4 * 1024 * 1024;
const DOCX_FAIL_MESSAGE =
  "워드(.docx) 파일이 아니거나 손상되었습니다. 한글 파일을 변환했는지 확인해 주세요.";
const ONBOARDING_CHAR_LIMIT = 24_000;
const PARSE_PREFIX_CHARS = 4_000;

export type ManualFilePayload = {
  name: string;
  media_type: string;
  data: string;
};

export type ResolvedManual = {
  text: string;
  pdf: ManualFilePayload | null;
};

export function isManualFilePayload(value: unknown): value is ManualFilePayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.media_type === "string" &&
    typeof value.data === "string" &&
    value.data.length > 0
  );
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function classifyManualName(name: string, mediaType = ""): "hwp" | "docx" | "pdf" | "text" | "unsupported" {
  const ext = extensionOf(name);
  if (ext === ".hwp" || ext === ".hwpx") return "hwp";
  if (ext === ".docx" || mediaType.includes("wordprocessingml")) return "docx";
  if (ext === ".pdf" || mediaType === "application/pdf") return "pdf";
  if (ext === ".txt" || ext === ".md" || ext === ".markdown" || mediaType.startsWith("text/")) return "text";
  return "unsupported";
}

function stripDataUrl(data: string): string {
  const comma = data.indexOf(",");
  return data.startsWith("data:") && comma >= 0 ? data.slice(comma + 1) : data;
}

function decodeBase64(data: string): Uint8Array {
  const padded = stripDataUrl(data);
  const BufferCtor = (globalThis as { Buffer?: { from(input: string, enc: string): Uint8Array } }).Buffer;
  if (BufferCtor) {
    return BufferCtor.from(padded, "base64");
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type MammothExtract = (input: { buffer: Uint8Array }) => Promise<{ value: string }>;

async function extractDocx(data: string): Promise<string> {
  const loaded = await import("mammoth");
  const extractRawText = loaded.extractRawText as unknown as MammothExtract;
  try {
    const result = await extractRawText({ buffer: decodeBase64(data) });
    const text = result.value.trim();
    if (!text) throw new Error("DOCX에서 텍스트를 읽지 못했습니다.");
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DOCX에서")) throw error;
    throw new Error(DOCX_FAIL_MESSAGE);
  }
}

function decodeTextFile(data: string): string {
  const text = new TextDecoder("utf-8").decode(decodeBase64(data)).trim();
  if (!text) throw new Error("파일이 비어 있습니다.");
  return text;
}

export async function resolveManualInput(textInput: unknown, fileInput: unknown): Promise<ResolvedManual> {
  const pasted = typeof textInput === "string" ? textInput.trim() : "";
  if (!isManualFilePayload(fileInput)) {
    if (!pasted) throw new Error("Missing text");
    return { text: pasted, pdf: null };
  }

  const kind = classifyManualName(fileInput.name, fileInput.media_type);
  if (kind === "hwp") throw new Error(HWP_MESSAGE);
  if (kind === "unsupported") {
    throw new Error("지원하지 않는 형식입니다. DOCX, PDF, TXT, MD만 업로드할 수 있습니다.");
  }

  const rawBytes = decodeBase64(fileInput.data);
  if (rawBytes.byteLength > MAX_MANUAL_FILE_BYTES) {
    throw new Error("파일이 너무 큽니다. 4MB 이하로 올려 주세요.");
  }

  if (kind === "docx") {
    const extracted = await extractDocx(fileInput.data);
    return { text: pasted && pasted !== extracted ? `${extracted}\n\n${pasted}` : extracted, pdf: null };
  }

  if (kind === "pdf") {
    return {
      text: pasted,
      pdf: {
        name: fileInput.name,
        media_type: "application/pdf",
        data: stripDataUrl(fileInput.data),
      },
    };
  }

  const extracted = decodeTextFile(fileInput.data);
  return { text: pasted && pasted !== extracted ? `${extracted}\n\n${pasted}` : extracted, pdf: null };
}

export function hasManualContent(resolved: ResolvedManual): boolean {
  return Boolean(resolved.text) || Boolean(resolved.pdf);
}

export function excerptForOnboarding(text: string): string {
  if (!text || text.length <= ONBOARDING_CHAR_LIMIT) return text;
  const headerLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) continue;
    if (/(부서|직책|조직|역할|목차|팀\s*구성|(?:1[0-2]|[1-9])\s*월)/.test(trimmed)) {
      headerLines.push(trimmed);
    }
  }
  const headers = [...new Set(headerLines)].slice(0, 80).join("\n");
  return `${text.slice(0, ONBOARDING_CHAR_LIMIT)}\n\n--- 문서에서 뽑은 헤더 ---\n${headers}`;
}

type MonthSpan = { month: number; start: number; end: number };

function findMonthSections(text: string): MonthSpan[] {
  const hits = monthHeadingHits(text);
  if (hits.length < 3) return [];
  return hits.map((hit, index) => ({
    month: hit.month,
    start: hit.index,
    end: index + 1 < hits.length ? hits[index + 1].index : text.length,
  }));
}

export function sliceManualForMonths(text: string, months: number[] | null): string {
  if (!text || !months || months.length === 0) return text;
  const sections = findMonthSections(text);
  if (sections.length === 0) return text;
  const wanted = new Set(months);
  const parts = sections.filter((section) => wanted.has(section.month)).map((section) => text.slice(section.start, section.end).trim());
  if (parts.length === 0) return text;
  const prefix = text.slice(0, Math.min(PARSE_PREFIX_CHARS, text.length)).trim();
  return `${prefix}\n\n--- 해당 월 구간 ---\n${parts.join("\n\n")}`;
}

export function withManualText(resolved: ResolvedManual, text: string): ResolvedManual {
  return { ...resolved, text };
}

export function buildManualUserContent(
  instruction: string,
  resolved: ResolvedManual,
): Anthropic.MessageParam["content"] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (resolved.pdf) {
    blocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: resolved.pdf.data,
      },
    });
  }
  blocks.push({
    type: "text",
    text: resolved.text ? `${instruction}\n\n${resolved.text}` : instruction,
  });
  return blocks;
}
