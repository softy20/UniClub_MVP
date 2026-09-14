import type Anthropic from "@anthropic-ai/sdk";
import { isRecord } from "./schema.ts";

export const HWP_MESSAGE = "한글(.hwp) 파일은 워드(.docx)로 변환하여 업로드해 주세요";
export const MAX_MANUAL_FILE_BYTES = 4 * 1024 * 1024;

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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function extractDocx(data: string): Promise<string> {
  const loaded = (await import("mammoth")) as unknown as {
    extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    default?: { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
  };
  const mammoth = loaded.extractRawText ? loaded : loaded.default;
  if (!mammoth?.extractRawText) {
    throw new Error("DOCX 파서를 불러오지 못했습니다.");
  }
  const result = await mammoth.extractRawText({ arrayBuffer: bytesToArrayBuffer(decodeBase64(data)) });
  const text = result.value.trim();
  if (!text) throw new Error("DOCX에서 텍스트를 읽지 못했습니다.");
  return text;
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
