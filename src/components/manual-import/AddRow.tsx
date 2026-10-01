import type { KeyboardEvent } from "react";

/**
 * 부서/행사 분류를 새로 추가할 때 쓰는 입력창 + "추가" 버튼 한 줄짜리 컴포넌트.
 * 특이사항: Enter 키를 눌러도 onAdd가 호출된다(버튼 클릭과 동일하게 동작).
 */
export function AddRow({
  value,
  placeholder,
  onChange,
  onAdd,
  disabled,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  function submit() {
    if (disabled) return;
    onAdd();
  }
  return (
    <div className="mt-6 flex gap-2 border-t border-border pt-5">
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="flex-1 rounded-[10px] border-[1.5px] border-border bg-bg px-3.5 py-[9px] text-[13px] text-fg outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        className="cursor-pointer rounded-[10px] border-0 bg-border px-4 py-[9px] text-[13px] font-semibold text-fg2 disabled:opacity-60"
        disabled={disabled}
      >
        + 추가
      </button>
    </div>
  );
}
