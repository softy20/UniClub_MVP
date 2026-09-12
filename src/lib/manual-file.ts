const TEXT_EXT = [".txt", ".md", ".markdown"];

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export async function extractManualText(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  if (ext === ".hwp" || ext === ".hwpx") {
    throw new Error("HWP는 현재 지원하지 않습니다. TXT, MD, DOCX 파일을 사용해 주세요.");
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.default.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = result.value.trim();
    if (!text) throw new Error("DOCX에서 텍스트를 읽지 못했습니다.");
    return text;
  }
  if (TEXT_EXT.includes(ext) || file.type.startsWith("text/")) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("파일이 비어 있습니다.");
    return text;
  }
  throw new Error("지원하지 않는 형식입니다. TXT, MD, DOCX만 업로드할 수 있습니다.");
}
