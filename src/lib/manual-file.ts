/**
 * 🧭 UniClub - manual-file.ts
 *
 * 동아리 운영 매뉴얼 파일(워드/PDF/텍스트)을 업로드할 때, 그 파일을 읽고 검사하고 AI에게 보낼 수 있는 형태로 바꿔주는 파일입니다.
 *
 * 📌 주요 기능:
 * - 업로드한 파일이 어떤 종류(docx, pdf, text, hwp, 지원안됨)인지 확인
 * - 파일 크기와 형식이 올바른지 검사하고, 안 맞으면 한국어 오류 메시지 보여주기
 * - docx 파일에서 순수 텍스트만 뽑아내기 (mammoth 라이브러리 사용)
 * - 파일을 base64 문자열로 바꿔서 서버(API)로 보낼 수 있게 준비
 * - 안내 문구(용량 제한, 업로드 팁 등) 상수로 제공
 *
 * 🔗 사용 예시:
 * ```ts
 * // 파일 업로드 컴포넌트에서 이렇게 씁니다
 * import { readManualFile, filePayloadForApi, MANUAL_ACCEPT } from './manual-file'
 *
 * const { payload, previewText } = await readManualFile(file);
 * const apiPayload = filePayloadForApi(payload);
 * ```
 *
 * 🎯 주요 관리 요소:
 * - HWP_MESSAGE, MANUAL_UPLOAD_GUIDE, MANUAL_SIZE_GUIDE, MANUAL_ACCEPT, MAX_MANUAL_FILE_BYTES: 안내 문구/제한 상수
 * - ManualFileKind, ManualFilePayload: 파일 종류와 파일 데이터의 타입
 * - classifyManualFile(file): 파일 확장자를 보고 종류를 구분하는 함수
 * - readManualFile(file): 파일을 실제로 읽어서 payload와 미리보기 텍스트를 만드는 함수 (비동기)
 * - filePayloadForApi(file): 서버에 보낼 형태로 파일 정보를 변환하는 함수
 *
 * 💡 팁 및 주의사항:
 * - 파일은 4MB(MAX_MANUAL_FILE_BYTES)를 넘으면 읽지 않고 오류를 던집니다.
 * - docx 파일은 mammoth 라이브러리를 동적으로 불러와서(import) 텍스트만 추출하고, 원본 파일 데이터는 보내지 않습니다.
 * - hwp/hwpx 파일은 지원하지 않으며, 사용자에게 워드로 변환하라고 안내합니다.
 * - readManualFile은 실패 시 Error를 던지므로, 호출하는 쪽에서 try/catch로 감싸야 합니다.
 *
 * @file manual-file.ts
 * @module lib/manual-file
 */

export const HWP_MESSAGE = "한글(.hwp) 파일은 워드(.docx)로 변환하여 업로드해 주세요";
export const MANUAL_UPLOAD_GUIDE =
  "동아리 조직 구성, 연간 행사 일정, 사전 준비 기간, 담당 부서가 명시되어 있으면 AI 정확도가 높아집니다.";
export const MANUAL_SIZE_GUIDE =
  "파일은 4MB 이하만 올려 주세요. 사진이 들어 있으면 용량이 커지니, 글자만 남기면 매뉴얼이 훨씬 가벼워집니다.";
export const MANUAL_ACCEPT = ".docx,.pdf,.txt,.md,.markdown,.hwp,.hwpx";
export const MAX_MANUAL_FILE_BYTES = 4 * 1024 * 1024;
const DOCX_FAIL_MESSAGE =
  "워드(.docx) 파일이 아니거나 손상되었습니다. 한글 파일을 변환했는지 확인해 주세요.";

export type ManualFileKind = "docx" | "pdf" | "text";

export type ManualFilePayload = {
  name: string;
  media_type: string;
  data: string;
  kind: ManualFileKind;
};

const TEXT_EXT = [".txt", ".md", ".markdown"];

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function classifyManualFile(file: File): "hwp" | ManualFileKind | "unsupported" {
  const ext = extensionOf(file.name);
  if (ext === ".hwp" || ext === ".hwpx") return "hwp";
  if (ext === ".docx") return "docx";
  if (ext === ".pdf") return "pdf";
  if (TEXT_EXT.includes(ext) || file.type.startsWith("text/")) return "text";
  return "unsupported";
}

function mimeFor(kind: ManualFileKind, file: File): string {
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "pdf") return "application/pdf";
  return file.type || "text/plain";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function extractDocxFile(file: File): Promise<string> {
  const loaded = await import("mammoth");
  try {
    const result = await loaded.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = result.value.trim();
    if (!text) throw new Error("DOCX에서 텍스트를 읽지 못했습니다.");
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DOCX에서")) throw error;
    throw new Error(DOCX_FAIL_MESSAGE);
  }
}

export async function readManualFile(file: File): Promise<{ payload: ManualFilePayload; previewText: string }> {
  const kind = classifyManualFile(file);
  if (kind === "hwp") throw new Error(HWP_MESSAGE);
  if (kind === "unsupported") {
    throw new Error("지원하지 않는 형식입니다. DOCX, PDF, TXT, MD만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_MANUAL_FILE_BYTES) {
    throw new Error("파일이 너무 큽니다. 4MB 이하로 올려 주세요.");
  }

  if (kind === "text") {
    const previewText = (await file.text()).trim();
    if (!previewText) throw new Error("파일이 비어 있습니다.");
    return {
      payload: {
        name: file.name,
        media_type: mimeFor(kind, file),
        data: "",
        kind,
      },
      previewText,
    };
  }

  if (kind === "docx") {
    const previewText = await extractDocxFile(file);
    return {
      payload: {
        name: file.name,
        media_type: "text/plain",
        data: "",
        kind: "text",
      },
      previewText,
    };
  }

  return {
    payload: {
      name: file.name,
      media_type: mimeFor(kind, file),
      data: await fileToBase64(file),
      kind,
    },
    previewText: "",
  };
}

export function filePayloadForApi(file: ManualFilePayload | null): { name: string; media_type: string; data: string } | undefined {
  if (!file || file.kind === "text" || !file.data) return undefined;
  return { name: file.name, media_type: file.media_type, data: file.data };
}
