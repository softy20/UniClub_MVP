/**
 * 확인 질문에 답변을 보내고 서버 응답을 기다리는 동안 보여주는 "처리 중" 안내 배너.
 * @param label - 배너에 표시할 상태 문구(예: "답변 전송 중", "부서표 확정 중")
 */
export function ClarifyingBusyBanner({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-accent">{label}</p>
        <span className="pulse-dot size-2 rounded-full bg-accent" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border2" aria-hidden>
        <div className="progress-indeterminate h-full w-[34%] rounded-full bg-accent" />
      </div>
    </div>
  );
}
