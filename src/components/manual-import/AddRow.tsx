/**
 * 🧭 UniClub - AddRow (부서/분류 추가 입력줄)
 *
 * 부서나 행사 분류를 새로 추가할 때 쓰는 "입력창 + + 추가 버튼" 한 줄짜리 부품입니다.
 * 운영 매뉴얼 마법사의 "부서/분류 확정" 화면(LockedPhase)에서 사용합니다.
 *
 * 📌 주요 기능:
 * - 이름을 입력하고 버튼을 누르면 onAdd를 호출합니다.
 * - Enter 키를 눌러도 버튼을 누른 것과 똑같이 동작합니다.
 * - disabled가 true면 입력과 버튼이 모두 막힙니다(서버 요청 중 등).
 *
 * 🔗 사용 예시:
 * ```tsx
 * <AddRow value={name} placeholder="새 부서 이름" onChange={setName} onAdd={addRole} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: AddRow
 * - 외부에서 전달받는 데이터(Props): value, placeholder, onChange, onAdd, disabled
 * - 내부 State: 없음(입력값은 부모가 들고 있음)
 *
 * 💡 팁 및 주의사항:
 * - 추가 버튼을 눌렀을 때 입력값 검증(빈 값, 중복)은 이 컴포넌트가 아니라 부모의 onAdd에서 처리합니다.
 *
 * @file AddRow.tsx
 * @module components/manual-import/AddRow
 */
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
