/**
 * 🧭 UniClub - FileDropzone (파일 끌어다 놓기 영역)
 *
 * 운영 매뉴얼 파일을 드래그해서 놓거나, 클릭해서 탐색기로 고를 수 있는 업로드 영역입니다.
 *
 * 📌 주요 기능:
 * - 파일을 끌어 올리면 테두리와 배경색이 바뀌어 놓을 수 있음을 알려줍니다.
 * - 영역 클릭 또는 Enter/Space 키로 파일 선택창을 엽니다.
 * - 지원 확장자(.md, .docx, .pdf, .txt)를 안내합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <FileDropzone onFileSelect={(file) => handleFile(file)} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: FileDropzone
 * - 외부에서 전달받는 데이터(Props): onFileSelect(고른 파일을 받는 콜백)
 * - 내부 State: isDragging(드래그 중인지)
 * - 의존성: ../../lib/manual-file(MANUAL_ACCEPT)
 *
 * 💡 팁 및 주의사항:
 * - 실제 파일 읽기/검증은 onFileSelect를 받는 부모가 합니다.
 * - 같은 파일을 다시 고를 수 있도록, 선택할 때마다 input의 value를 비웁니다.
 *
 * @file FileDropzone.tsx
 * @module components/manual-import/FileDropzone
 */
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { MANUAL_ACCEPT } from "../../lib/manual-file";

/**
 * 매뉴얼 파일을 드래그해서 놓거나 클릭해서 탐색기로 고를 수 있는 업로드 영역 컴포넌트.
 * 특이사항: 드래그 중인지(isDragging) 상태만 내부에서 관리하고, 실제 파일 처리는
 * onFileSelect 콜백으로 위임한다. 같은 파일을 다시 선택할 수 있도록 매 선택 후
 * input의 value를 비운다.
 */
export function FileDropzone({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
    event.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all"
      style={{
        borderColor: isDragging ? "var(--accent)" : "var(--border2)",
        background: isDragging ? "rgba(0,102,255,0.04)" : "var(--card)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={MANUAL_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="font-display mb-2 text-lg font-semibold text-fg">운영 매뉴얼 업로드</p>
      <p className="text-sm font-medium text-fg2">
        파일을 드래그하여 올리거나 <span className="text-accent underline">여기 클릭</span>하여 탐색기 열기
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {[".md", ".docx", ".pdf", ".txt"].map((ext) => (
          <span
            key={ext}
            className="rounded-md border border-border bg-card2 px-2 py-1 text-[13px] font-semibold text-fg3"
          >
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
}
