/**
 * 🧭 UniClub - ParseProgressBar (일정 추출 진행률 막대)
 *
 * 일정을 추출하는 동안 화면에 보여주는 얇은 진행률 막대입니다.
 *
 * 📌 주요 기능:
 * - 0~100 사이 값을 받아 막대 너비로 그립니다(범위를 벗어나면 잘라냅니다).
 * - 거의 끝(99% 이상)일 때는 부드럽게 길게 채우는 전환 효과를 씁니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * {loading ? <ParseProgressBar value={parseFill} /> : null}
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: ParseProgressBar
 * - 외부에서 전달받는 데이터(Props): value(진행률 %)
 *
 * 💡 팁 및 주의사항:
 * - 값은 useEventExtraction이 실제 진행 상황에 애니메이션을 섞어 계산한 것이라 정확한 퍼센트가 아닐 수 있습니다.
 *
 * @file ParseProgressBar.tsx
 * @module components/manual-import/ParseProgressBar
 */
/**
 * 일정 추출 진행률을 보여주는 얇은 막대 바 컴포넌트.
 * @param value - 0~100 사이의 진행률(%). 범위를 벗어나면 0~100으로 잘라서 표시한다.
 */
export function ParseProgressBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border2" aria-hidden>
      <div
        className="h-full rounded-full bg-accent"
        style={{
          width: `${width}%`,
          transition:
            width >= 99
              ? "width 520ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "width 120ms linear",
        }}
      />
    </div>
  );
}
