/**
 * 🧭 UniClub - ClarifyingBusyBanner (답변 처리 중 안내 배너)
 *
 * 확인 질문에 답변을 보내고 서버 응답을 기다리는 동안, 화면 위쪽에 보여주는 "처리 중" 안내 배너입니다.
 *
 * 📌 주요 기능:
 * - 상태 문구(예: "답변 전송 중", "부서표 확정 중")와 깜빡이는 점을 보여줍니다.
 * - 끝이 없는(indeterminate) 진행 막대를 함께 보여줍니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * {loading ? <ClarifyingBusyBanner label="답변 전송 중" /> : null}
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: ClarifyingBusyBanner
 * - 외부에서 전달받는 데이터(Props): label(배너에 표시할 문구)
 *
 * 💡 팁 및 주의사항:
 * - 실제 진행률이 아니라 "기다리는 중"임을 알리는 용도의 애니메이션입니다.
 * - role="status"와 aria-live가 있어 스크린 리더가 상태 변화를 읽어 줍니다.
 *
 * @file ClarifyingBusyBanner.tsx
 * @module components/manual-import/ClarifyingBusyBanner
 */
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
