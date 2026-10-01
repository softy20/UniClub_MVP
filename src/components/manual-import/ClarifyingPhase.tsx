/**
 * 🧭 UniClub - ClarifyingPhase (확인 질문 단계 화면)
 *
 * 운영 매뉴얼 마법사에서 AI가 던진 확인 질문(부서, 별칭, 동아리명, 행사 분류)을 한 번에 하나씩 보여주고 답을 받는 화면입니다.
 *
 * 📌 주요 기능:
 * - 몇 번째 질문인지, 현재 턴이 몇 번째인지 진행 막대로 보여줍니다.
 * - 질문에 맞춰 추출된 부서/분류 패널을 함께 보여줍니다.
 * - 선택지를 고르거나 "기타"를 골라 직접 입력할 수 있고, 질문이 없으면 자유 입력창을 보여줍니다.
 * - "이전 단계로", "확인", "처음부터" 버튼을 제공합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <ClarifyingPhase loading={loading} error={error} currentQuestion={currentQuestion} ... onConfirm={confirm} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: ClarifyingPhase
 * - 외부에서 전달받는 데이터(Props): 질문/선택 상태와 이를 바꾸는 콜백 모음(ClarifyingPhaseProps 참고)
 * - 내부 State: 없음(모든 상태는 ManualImportWizard가 들고 있음)
 * - 의존성: ./ClarifyingBusyBanner, ./ExtractedPanels, ./constants, ./utils
 *
 * 💡 팁 및 주의사항:
 * - questionIndex는 이미 범위 보정된 값을 받습니다. 답변 조합/서버 전송은 부모의 onChooseOption/onConfirm이 처리합니다.
 *
 * @file ClarifyingPhase.tsx
 * @module components/manual-import/ClarifyingPhase
 */
import type { RefObject } from "react";
import type { CategoryDefinition, ClarifyingQuestion, QuestionOption, RoleDefinition } from "../../lib/types";
import { ClarifyingBusyBanner } from "./ClarifyingBusyBanner";
import { CATEGORY_LABEL, MAX_TURNS } from "./constants";
import { ExtractedCategoriesPanel, ExtractedRolesPanel } from "./ExtractedPanels";
import { isOtherOption } from "./utils";

type ClarifyingPhaseProps = {
  loading: boolean;
  error: string;
  busyLabel: string;
  turn: number;
  questionCount: number;
  questionIndex: number;
  currentQuestion: ClarifyingQuestion | undefined;
  currentKey: string;
  selectedId: string | undefined;
  showOther: boolean;
  showExtractedRoles: boolean;
  showExtractedCategories: boolean;
  showAliasHint: boolean;
  draftRoles: RoleDefinition[];
  draftCategories: CategoryDefinition[];
  otherDraftValue: string;
  otherInputRef: RefObject<HTMLTextAreaElement | null>;
  onChooseOption: (question: ClarifyingQuestion, option: QuestionOption) => void;
  onOtherChange: (value: string) => void;
  onFreeformChange: (value: string) => void;
  onPrev: () => void;
  onConfirm: () => void;
  onReset: () => void;
};

/**
 * 부서/행사 분류 확인 질문을 한 번에 하나씩 보여주는 단계 화면.
 * 특이사항: questionIndex는 이미 범위 보정된 값(safeQuestionIndex)을 받는다. 답변 조합/전송 로직은
 * 부모가 onChooseOption/onConfirm으로 처리한다.
 */
export function ClarifyingPhase({
  loading,
  error,
  busyLabel,
  turn,
  questionCount,
  questionIndex: safeQuestionIndex,
  currentQuestion,
  currentKey,
  selectedId,
  showOther,
  showExtractedRoles,
  showExtractedCategories,
  showAliasHint,
  draftRoles,
  draftCategories,
  otherDraftValue,
  otherInputRef,
  onChooseOption,
  onOtherChange,
  onFreeformChange,
  onPrev,
  onConfirm,
  onReset,
}: ClarifyingPhaseProps) {
  return (
    <section className="flex min-h-[calc(100%-1rem)] flex-col justify-center py-8">
      {loading ? <ClarifyingBusyBanner label={busyLabel} /> : null}
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="mb-10">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.08em] text-fg3 uppercase">
            {safeQuestionIndex + 1} / {questionCount} 단계 확인 중 · 턴 {turn}/{MAX_TURNS}
          </span>
          <span className="text-xs text-fg3">{Math.round(((safeQuestionIndex + 1) / questionCount) * 100)}% 완료</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: questionCount }, (_, index) => (
            <div
              key={index}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{ background: index <= safeQuestionIndex ? "var(--accent)" : "var(--border)" }}
            />
          ))}
        </div>
      </div>

      <div
        key={currentKey}
        className="fade-in rounded-[20px] border border-border bg-card px-5 pt-7 pb-6 md:px-10 md:pt-10 md:pb-9"
        aria-busy={loading}
      >
        <p className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
          {currentQuestion ? CATEGORY_LABEL[currentQuestion.category] : "추가 확인"} · 확인 {safeQuestionIndex + 1}단계
        </p>
        <h2 className="font-display mb-2 text-[22px] leading-snug font-bold text-fg">
          {currentQuestion?.question ?? "추가로 알려주실 내용이 있나요?"}
        </h2>
        <p className={`text-sm leading-relaxed text-fg3 ${showExtractedRoles || showExtractedCategories ? "mb-4" : "mb-7"}`}>
          {currentQuestion
            ? showAliasHint
              ? "매뉴얼에서 감지된 부서 별칭이 있습니다. 통합 여부를 선택하세요."
              : showExtractedCategories
                ? "매뉴얼에서 뽑은 짧은 분류입니다. 이후 일정 추출은 이 목록만 사용합니다."
                : "매뉴얼에서 추출한 내용입니다. 선택지를 고르면 다음 질문으로 이동합니다."
            : "선택지가 없으면 내용을 입력한 뒤 확인을 눌러 주세요."}
        </p>

        {showExtractedRoles ? <ExtractedRolesPanel roles={draftRoles} /> : null}
        {showExtractedCategories ? <ExtractedCategoriesPanel categories={draftCategories} /> : null}

        {currentQuestion ? (
          <div className="flex flex-col gap-2.5">
            {currentQuestion.options.map((option) => {
              const selected = selectedId === option.id;
              const customOpen = selected && isOtherOption(option);
              return (
                <div key={option.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onChooseOption(currentQuestion, option)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-[18px] py-3.5 text-left text-sm font-medium text-fg disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      background: selected ? "rgba(0,102,255,0.06)" : "var(--bg)",
                    }}
                  >
                    <span
                      className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{
                        border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent)" : "transparent",
                      }}
                    >
                      {selected ? <span className="size-[7px] rounded-full bg-white" /> : null}
                    </span>
                    {isOtherOption(option) ? <span className="text-fg3">{option.label}</span> : option.label}
                  </button>
                  {customOpen ? (
                    <div className="fade-in mt-2 flex gap-2">
                      <textarea
                        ref={otherInputRef}
                        autoFocus
                        disabled={loading}
                        value={otherDraftValue}
                        onChange={(event) => onOtherChange(event.target.value)}
                        rows={3}
                        className="w-full rounded-[10px] border-[1.5px] border-accent bg-bg p-3 text-sm text-fg outline-none disabled:opacity-60"
                        placeholder="직접 입력해 주세요..."
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <textarea
            ref={otherInputRef}
            disabled={loading}
            value={otherDraftValue}
            onChange={(event) => onFreeformChange(event.target.value)}
            rows={4}
            className="w-full rounded-[10px] border-[1.5px] border-border bg-bg p-3 text-sm text-fg disabled:opacity-60"
            placeholder="추가로 확정할 내용을 입력하세요."
          />
        )}

        <div className="mt-6 flex items-center gap-3">
          {safeQuestionIndex > 0 ? (
            <button
              type="button"
              disabled={loading}
              onClick={onPrev}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ← 이전 단계로
            </button>
          ) : null}
          <div className="flex-1" />
          {showOther || !currentQuestion ? (
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="font-display cursor-pointer rounded-[10px] bg-accent px-[18px] py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? busyLabel : "확인"}
            </button>
          ) : loading ? (
            <p className="text-[13px] font-semibold text-accent">{busyLabel}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={onReset}
        className="mt-4 self-start text-[13px] text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        처음부터
      </button>
    </section>
  );
}
