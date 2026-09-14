export const HWP_MESSAGE = "한글(.hwp) 파일은 워드(.docx)로 변환하여 업로드해 주세요";
export const MANUAL_UPLOAD_GUIDE =
  "동아리 조직 구성, 연간 행사 일정, 사전 준비 기간, 담당 부서가 명시되어 있으면 AI 정확도가 높아집니다.";
export const MANUAL_SIZE_GUIDE =
  "파일은 4MB 이하만 올려 주세요. 사진이 들어 있으면 용량이 커지니, 글자만 남기면 매뉴얼이 훨씬 가벼워집니다.";
export const MANUAL_ACCEPT = ".docx,.pdf,.txt,.md,.markdown,.hwp,.hwpx";
export const MAX_MANUAL_FILE_BYTES = 4 * 1024 * 1024;

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
