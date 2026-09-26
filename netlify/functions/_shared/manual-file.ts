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

/**
 * 값이 업로드된 매뉴얼 파일 페이로드(name/media_type/base64 data) 형태인지 검사한다.
 */
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

/**
 * 파일 이름 확장자와 media_type을 보고 매뉴얼 파일 종류를 분류한다.
 * @returns "hwp" | "docx" | "pdf" | "text" | "unsupported" 중 하나
 */
export function classifyManualName(name: string, mediaType = ""): "hwp" | "docx" | "pdf" | "text" | "unsupported" {
  const ext = extensionOf(name);
  if (ext === ".hwp" || ext === ".hwpx") return "hwp";
  if (ext === ".docx" || mediaType.includes("wordprocessingml")) return "docx";
  if (ext === ".pdf" || mediaType === "application/pdf") return "pdf";
  if (ext === ".txt" || ext === ".md" || ext === ".markdown" || mediaType.startsWith("text/")) return "text";
  return "unsupported";
}

/**
 * "data:...;base64,XXXX" 형태의 데이터 URL이면 콤마 이전의 접두어를 제거하고 base64
 * 본문만 남긴다. 이미 순수 base64 문자열이면 그대로 반환한다.
 */
function stripDataUrl(data: string): string {
  const comma = data.indexOf(",");
  return data.startsWith("data:") && comma >= 0 ? data.slice(comma + 1) : data;
}

/**
 * base64(또는 데이터 URL) 문자열을 바이트 배열로 디코딩한다.
 * 특이사항: Node 런타임이면 Buffer를, 그렇지 않으면(Deno/브라우저류) atob 기반 폴백을 쓴다.
 */
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

/**
 * base64로 인코딩된 DOCX 파일에서 순수 텍스트를 추출한다(mammoth 사용).
 * 특이사항: 추출 결과가 빈 문자열이면 에러를 던지고, mammoth 자체가 실패하면(손상/형식 오류)
 * 사용자용 한국어 안내 메시지(DOCX_FAIL_MESSAGE)로 감싸서 던진다.
 */
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

/**
 * base64로 인코딩된 텍스트 파일(txt/md)을 UTF-8 문자열로 디코딩한다.
 * 특이사항: 디코딩 결과가 빈 문자열이면 에러를 던진다.
 */
function decodeTextFile(data: string): string {
  const text = new TextDecoder("utf-8").decode(decodeBase64(data)).trim();
  if (!text) throw new Error("파일이 비어 있습니다.");
  return text;
}

/**
 * 요청으로 들어온 붙여넣은 텍스트(textInput)와 업로드 파일(fileInput)을 검증/디코딩해서
 * 이후 처리에 쓸 통일된 형태(ResolvedManual)로 만든다.
 * @returns 텍스트와(있다면) PDF 원본 데이터를 담은 ResolvedManual
 * 특이사항: HWP는 지원하지 않아 안내 메시지와 함께 예외를 던지고, DOCX/TXT/MD는 텍스트로
 * 추출하며 붙여넣은 텍스트와 다르면 이어붙인다. PDF는 텍스트로 추출하지 않고 원본을 그대로
 * 모델에 첨부 문서로 전달하기 위해 pdf 필드에 담아 반환한다. 4MB를 넘는 파일은 거부한다.
 */
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

/**
 * 온보딩 단계에서 모델에 보낼 매뉴얼 텍스트를 글자 수 상한(ONBOARDING_CHAR_LIMIT) 이내로
 * 줄인다. 문서가 길면 앞부분만 자르고, 부서/직책/월 등을 가리키는 것으로 보이는 짧은 헤더성
 * 줄들을 문서 전체에서 뽑아 뒤에 덧붙여 뒤쪽 정보 손실을 보완한다.
 * 특이사항: 길이가 상한 이내면 원문을 그대로 반환한다.
 */
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

/**
 * 텍스트에서 월(月) 헤딩 위치를 찾아, 각 헤딩부터 다음 헤딩 전까지를 그 달의 구간으로
 * 잘라낸다.
 * 특이사항: 월 헤딩이 3개 미만이면(구간을 나눌 근거가 부족하면) 빈 배열을 반환한다.
 */
function findMonthSections(text: string): MonthSpan[] {
  const hits = monthHeadingHits(text);
  if (hits.length < 3) return [];
  return hits.map((hit, index) => ({
    month: hit.month,
    start: hit.index,
    end: index + 1 < hits.length ? hits[index + 1].index : text.length,
  }));
}

/**
 * 특정 월들만 추출할 때, 토큰을 아끼기 위해 매뉴얼 텍스트를 해당 월 구간만으로 줄인다.
 * 문서 앞부분(PARSE_PREFIX_CHARS)은 공통 정보(부서표 등)일 수 있어 항상 유지하고, 그 뒤에
 * 요청받은 월들의 구간만 이어붙인다.
 * 특이사항: months가 비었거나 월 구간을 못 찾으면(예: 헤딩이 3개 미만) 원문을 그대로 반환한다.
 */
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

/**
 * Anthropic 메시지의 user content 블록 배열을 만든다. PDF 원본이 있으면 document 블록으로
 * 먼저 첨부하고, 그 뒤에 지시문(instruction)과 매뉴얼 텍스트를 합친 text 블록을 붙인다.
 */
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
