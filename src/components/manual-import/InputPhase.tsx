import { Lightbulb } from "@phosphor-icons/react";
import {
  HWP_MESSAGE,
  MANUAL_TEXT_PLACEHOLDER,
  MANUAL_UPLOAD_GUIDE,
  MANUAL_UPLOAD_INTRO,
  type ManualFilePayload,
} from "../../lib/manual-file";
import { manualImportDepthLabel, type ManualImportDepth } from "../../lib/types";
import { FileDropzone } from "./FileDropzone";

type InputPhaseProps = {
  depth: ManualImportDepth;
  text: string;
  fileName: string;
  filePayload: ManualFilePayload | null;
  fileError: string;
  error: string;
  loading: boolean;
  onTextChange: (text: string) => void;
  onFile: (file: File) => void;
  onChangeDepth: () => void;
  onStart: () => void;
  onOpenSample: () => void;
};

/**
 * 입력 단계 본 화면: 매뉴얼 파일 업로드/텍스트 입력과 "부서 초안 추출" 버튼.
 * 특이사항: 상태는 전부 ManualImportWizard가 들고 있고, 이 컴포넌트는 값과 콜백만 받는다.
 */
export function InputPhase({
  depth,
  text,
  fileName,
  filePayload,
  fileError,
  error,
  loading,
  onTextChange,
  onFile,
  onChangeDepth,
  onStart,
  onOpenSample,
}: InputPhaseProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
        <button
          type="button"
          onClick={onChangeDepth}
          className="cursor-pointer text-[12px] font-semibold text-accent"
        >
          {manualImportDepthLabel(depth)} · 변경
        </button>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div
          className="mb-3 rounded-2xl border px-4 py-3.5"
          style={{
            background: "rgba(0,102,255,0.06)",
            borderColor: "rgba(0,102,255,0.18)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb size={18} weight="fill" color="#F5C518" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-accent">파일 업로드 가이드</p>
          </div>
          <div style={{ paddingLeft: "25px" }}>
            <p className="text-[13px] leading-relaxed text-fg2">
              <span className="font-semibold text-fg">{MANUAL_UPLOAD_INTRO}</span> {MANUAL_UPLOAD_GUIDE} 부서·직책이 없으면 공통으로 진행할 수 있습니다.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-fg2">
              파일은 <span className="font-semibold text-fg">4MB 이하</span>만 올려 주세요. 사진이 들어 있으면 용량이
              커지니, 글자만 남기면 매뉴얼이 훨씬 가벼워집니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["DOCX", "PDF", "TXT", "MD"].map((ext) => (
                <span
                  key={ext}
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent2"
                  style={{ background: "rgba(255,255,255,0.8)" }}
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>
          <div>

          </div>

        </div>
        <div className="mb-3">
          <FileDropzone onFileSelect={onFile} />
          {fileName ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card2 px-3 py-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)] text-[11px] font-bold text-[#16a34a]">
                ✓
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-fg">{fileName}</p>
                <p className="text-[12px] text-fg3">
                  {filePayload
                    ? "파일이 첨부되었습니다. 미리보기는 건너뛰고 추출 시 서버에서 읽습니다."
                    : "텍스트가 입력칸에 채워졌습니다. 긴 워드 매뉴얼도 여기서 바로 추출합니다."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        {fileError ? (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {fileError === HWP_MESSAGE ? HWP_MESSAGE : fileError}
          </p>
        ) : null}
        <label className="mb-2 block text-sm font-medium text-fg">매뉴얼 텍스트</label>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          rows={10}
          className="mb-3 w-full rounded-xl border border-border bg-card2 p-3 text-sm text-fg"
          placeholder={MANUAL_TEXT_PLACEHOLDER}
        />
        <button
          type="button"
          disabled={loading}
          onClick={onStart}
          className="font-display w-full cursor-pointer rounded-[10px] bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "부서 초안 추출 중..." : "부서 초안 추출"}
        </button>
        <button
          type="button"
          onClick={onOpenSample}
          className="mt-2 w-full cursor-pointer rounded-[10px] border border-border bg-card py-2.5 text-sm font-semibold text-fg2"
        >
          샘플 데이터로 미리보기 에디터 열기
        </button>
      </section>
    </>
  );
}
