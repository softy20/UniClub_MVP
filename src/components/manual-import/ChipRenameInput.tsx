/**
 * 🧭 UniClub - ChipRenameInput (이름 바꾸기 입력창)
 *
 * 부서 칩이나 분류 태그를 눌렀을 때, 그 자리에서 바로 이름을 고칠 수 있게 보여주는 작은 입력창입니다.
 *
 * 📌 주요 기능:
 * - 화면에 나타나면 자동으로 포커스가 들어갑니다.
 * - Enter를 누르거나 입력창 밖을 클릭(blur)하면 onCommit, Escape를 누르면 onCancel을 호출합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <ChipRenameInput value={text} onChange={setText} onCommit={commit} onCancel={cancel} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: ChipRenameInput
 * - 외부에서 전달받는 데이터(Props): value, onChange, onCommit, onCancel
 * - 내부 State: 없음
 *
 * 💡 팁 및 주의사항:
 * - blur와 Enter가 둘 다 onCommit을 부르므로, 부모의 commit 함수는 여러 번 불려도 안전해야 합니다.
 *
 * @file ChipRenameInput.tsx
 * @module components/manual-import/ChipRenameInput
 */
import type { KeyboardEvent } from "react";

/**
 * 부서 칩(chip)이나 분류 태그를 클릭했을 때, 이름을 바로 고칠 수 있게 보여주는 인라인 입력창.
 * 특이사항: 포커스를 잃거나(onBlur) Enter를 누르면 onCommit, Escape를 누르면 onCancel이 호출된다.
 */
export function ChipRenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
        if (event.key === "Escape") onCancel();
      }}
      className="rounded-lg border-[1.5px] border-accent bg-bg px-3 py-[5px] text-[13px] font-semibold text-fg outline-none"
    />
  );
}
