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
