/**
 * 🧭 UniClub - marks (작은 표시용 부품 모음)
 *
 * 화면 곳곳에서 반복해서 쓰이는 작은 표시 부품들(분류 태그, D-Day 배지, 담당자 칩,
 * 담당자 선택 드롭다운, 카테고리 필터)을 모아둔 파일입니다.
 *
 * 📌 주요 기능:
 * - Tag: 행사 분류(카테고리)를 색깔 있는 알약 모양으로 보여줍니다. 삭제/클릭 기능도 넣을 수 있습니다.
 * - DdayBadge / DminusBadge: 행사 자체의 D-Day(오늘 기준 남은 날짜, D-7/D-0/D+3 등)를 색깔로 보여줍니다.
 * - TaskDueBadge: 할 일의 마감을 "행사 N일 전"으로 보여줍니다. 행사 D-Day와 숫자가 같아 보여도
 *   서로 다른 기준(오늘 vs 행사일)이라 혼동되지 않도록 행사 배지와는 다른 문구를 씁니다.
 * - RoleChip: 담당 부서 이름을 색깔 있는 칩으로 보여줍니다. 클릭해서 수정하거나 삭제할 수 있습니다.
 * - RoleSelect: 담당 부서를 바꿀 수 있는 드롭다운 목록을 보여줍니다.
 * - CategoryFilter: 전체 행사 중 원하는 분류만 켜고 끌 수 있는 필터 버튼 묶음입니다.
 * - roleAccent: 부서 이름에 따라 항상 같은 색을 골라주는 함수입니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { Tag, RoleChip, CategoryFilter } from "./components/marks";
 * <Tag cat="MT" />
 * <RoleChip name="기획팀" roster={["기획팀", "홍보팀"]} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: Tag, DdayBadge, TaskDueBadge, RoleChip, RoleSelect, DminusBadge, CategoryFilter
 * - export되는 함수/상수: roleAccent(이름별 색상 계산), ROLE_COLORS(부서 색상 목록)
 * - RoleSelect 내부 State: open(드롭다운 열림 여부), anchor(드롭다운 위치 좌표)
 * - 의존성: ../lib/ops(카테고리 스타일, 분류 목록 뽑기), react-dom의 createPortal(드롭다운을
 *   화면 최상단에 겹쳐 그리기 위해 사용)
 *
 * 💡 팁 및 주의사항:
 * - RoleSelect의 드롭다운은 createPortal로 document.body에 그려지기 때문에, 화면 바깥
 *   클릭이나 스크롤, 창 크기 변경이 있으면 자동으로 닫히도록 이벤트를 등록/해제합니다.
 * - 이 파일에 있는 컴포넌트들은 다른 여러 화면에서 공통으로 가져다 쓰는 "부품"이므로,
 *   여기를 고치면 그 부품을 쓰는 모든 화면의 모양이 함께 바뀝니다.
 *
 * @file marks.tsx
 * @module components/marks
 */
import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { categoryStyle, uniqueCategoryLabels, type OpsEvent } from "../lib/ops";

function ChipRemoveButton({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      className="ml-0.5 cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-none opacity-70"
      style={{ color }}
      aria-label={`${label} 삭제`}
    >
      ×
    </button>
  );
}

export function Tag({
  cat,
  onClick,
  onRemove,
}: {
  cat: string;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const item = categoryStyle(cat);
  const className = "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[13px] font-semibold";
  const style = { color: item.color, background: item.bg };
  const dot = <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />;

  if (onRemove || onClick) {
    return (
      <span className={className} style={style}>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color: item.color }}
          >
            {dot}
            {item.label}
          </button>
        ) : (
          <>
            {dot}
            {item.label}
          </>
        )}
        {onRemove ? <ChipRemoveButton label={item.label} color={item.color} onRemove={onRemove} /> : null}
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {dot}
      {item.label}
    </span>
  );
}

export function DdayBadge({ dday }: { dday: string }) {
  const past = dday.startsWith("D+");
  const num = past ? Number.POSITIVE_INFINITY : Number(dday.replace("D-", ""));
  const dot = past ? "#94a3b8" : num <= 1 ? "#ef4444" : num <= 7 ? "#eab308" : "#22c55e";
  return (
    <span className="inline-flex h-5 items-center gap-[5px] text-[13px] leading-5 font-semibold text-[#888]">
      <span className="size-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      {dday}
    </span>
  );
}

/**
 * 할 일의 마감을 "행사 N일 전"으로 보여줍니다. daysBefore(행사 기준, 수정 화면과 같은 값)를
 * 문구로 쓰고, daysLeft(오늘 기준 실제 남은 일수)는 다급함을 알려주는 점 색으로만 씁니다.
 */
export function TaskDueBadge({ daysBefore, daysLeft }: { daysBefore: number; daysLeft: number }) {
  const past = daysLeft < 0;
  const dot = past ? "#94a3b8" : daysLeft <= 1 ? "#ef4444" : daysLeft <= 7 ? "#eab308" : "#22c55e";
  return (
    <span className="inline-flex h-5 items-center gap-[5px] text-[13px] leading-5 font-semibold text-[#888]">
      <span className="size-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      행사 {daysBefore}일 전
    </span>
  );
}

export const ROLE_COLORS = ["#0066FF", "#E8492C", "#00838F", "#6A4FE0", "#D81B7A", "#8E24AA"] as const;

export function roleAccent(name: string, roster: string[] = []): string {
  const indexed = roster.indexOf(name);
  if (indexed >= 0) return ROLE_COLORS[indexed % ROLE_COLORS.length];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ROLE_COLORS[Math.abs(hash) % ROLE_COLORS.length];
}

export function RoleChip({
  name,
  roster,
  accentName,
  asButton,
  onClick,
  onRemove,
}: {
  name: string;
  roster?: string[];
  accentName?: string;
  asButton?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const color = roleAccent(accentName ?? name, roster);
  const className =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-[5px] text-[13px] font-semibold";
  const style = {
    background: `${color}15`,
    color,
    border: `1px solid ${color}40`,
  };
  const remove = onRemove ? <ChipRemoveButton label={name} color={color} onRemove={onRemove} /> : null;

  if (onRemove) {
    return (
      <span className={className} style={style}>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color }}
          >
            {name}
          </button>
        ) : (
          name
        )}
        {remove}
      </span>
    );
  }

  if (onClick || asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} ${onClick ? "cursor-pointer" : "cursor-default"}`}
        style={style}
      >
        {name}
      </button>
    );
  }

  return (
    <span className={className} style={style}>
      {name}
    </span>
  );
}

export function RoleSelect({
  value,
  choices,
  roster,
  onChange,
}: {
  value: string;
  choices: string[];
  roster: string[];
  onChange: (role: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const color = roleAccent(value, roster);

  function placeAndOpen() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 160;
      const height = 12 + choices.length * 34;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top =
        rect.bottom + 4 + height > window.innerHeight - 8
          ? Math.max(8, rect.top - height - 4)
          : rect.bottom + 4;
      setAnchor({ top, left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-role-dropdown]")) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative" data-role-dropdown="">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : placeAndOpen())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`담당 ${value}`}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-[5px] text-[13px] font-semibold"
        style={{
          background: `${color}15`,
          color,
          border: `1px solid ${color}40`,
        }}
      >
        {value}
        <CaretDown
          size={11}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 opacity-70 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open
        ? createPortal(
            <div
              data-role-dropdown=""
              className="fade-in fixed z-[80] min-w-[148px] rounded-[10px] border border-border bg-card p-1.5"
              style={{ top: anchor.top, left: anchor.left, boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
              role="listbox"
            >
              {choices.map((role) => {
                const itemColor = roleAccent(role, roster);
                const isOn = role === value;
                return (
                  <button
                    key={role}
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    onClick={() => {
                      onChange(role);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-[7px] rounded-[7px] border-0 px-2.5 py-[7px] text-left text-[13px] transition-colors duration-100"
                    style={{
                      background: isOn ? `${itemColor}15` : "transparent",
                      color: isOn ? itemColor : "var(--fg)",
                      fontWeight: isOn ? 700 : 500,
                    }}
                  >
                    <span className="size-[7px] shrink-0 rounded-full" style={{ background: itemColor }} />
                    {role}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function DminusBadge({ daysLeft }: { daysLeft: number }) {
  const past = daysLeft < 0;
  const urgent = !past && daysLeft <= 7;
  const soon = !past && daysLeft <= 14;
  const color = past ? "#94a3b8" : urgent ? "#ef4444" : soon ? "#eab308" : "#0066FF";
  const dot = past ? "#94a3b8" : urgent ? "#ef4444" : soon ? "#eab308" : "#22c55e";
  const label = daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "D-0" : `D+${-daysLeft}`;
  return (
    <span className="inline-flex shrink-0 items-center gap-[5px] text-[13px] font-bold" style={{ color }}>
      <span className="size-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

type FilterProps = {
  events: OpsEvent[];
  active: Set<string>;
  onToggle: (cat: string) => void;
  onToggleAll: () => void;
};

export function CategoryFilter({ events, active, onToggle, onToggleAll }: FilterProps) {
  const categories = uniqueCategoryLabels(events);
  const allOn = categories.length > 0 && categories.every((cat) => active.has(cat));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleAll}
        className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] border-0 px-3.5 text-[13px] font-medium"
        style={{
          background: allOn ? "rgba(55,56,60,0.1)" : "var(--card)",
          color: allOn ? "var(--fg)" : "var(--fg3)",
        }}
      >
        <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: allOn ? "var(--fg)" : "var(--fg3)" }} />
        전체
      </button>
      {categories.map((cat) => {
        const item = categoryStyle(cat);
        const on = active.has(cat);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onToggle(cat)}
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] border-0 px-3.5 text-[13px] font-medium"
            style={{
              background: on ? item.bg : "var(--card)",
              color: on ? item.color : "var(--fg3)",
            }}
          >
            <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: on ? item.color : "var(--fg3)" }} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
