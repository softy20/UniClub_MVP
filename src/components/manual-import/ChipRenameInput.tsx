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
