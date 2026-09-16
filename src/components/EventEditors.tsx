import { CalendarBlank } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dayDiff } from "../lib/board";
import { monthCells, WEEKDAYS } from "../lib/calendar";
import { categoryStyle } from "../lib/ops";

export function isoDateParts(iso: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function dateFromIso(iso: string): Date | null {
  const parts = isoDateParts(iso);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12);
}

function formatPickedDateLabel(iso: string, today: Date): string {
  const parts = isoDateParts(iso);
  const date = dateFromIso(iso);
  if (!parts || !date) return "D-Day 날짜";
  const daysLeft = dayDiff(today, date);
  const dLabel = daysLeft >= 0 ? `D-${daysLeft}` : `D+${-daysLeft}`;
  return `${parts.month}/${parts.day}  ${dLabel}`;
}

function viewFromValue(value: string, today: Date, defaultMonth?: number) {
  const date = dateFromIso(value);
  if (date) return { year: date.getFullYear(), month: date.getMonth() };
  const month =
    defaultMonth && defaultMonth >= 1 && defaultMonth <= 12 ? defaultMonth - 1 : today.getMonth();
  return { year: today.getFullYear(), month };
}

export function EventCategoryButton({
  category,
  choices,
  open,
  onToggle,
  onSelect,
}: {
  category: string;
  choices: string[];
  open: boolean;
  onToggle: () => void;
  onSelect: (label: string) => void;
}) {
  const selected = category.trim();
  const style = selected ? categoryStyle(selected) : null;
  return (
    <div className="relative" data-cat-dropdown="">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="행사 분류"
        className="inline-flex shrink-0 cursor-pointer items-center gap-[5px] rounded-lg border px-2.5 py-[5px] text-[12px] font-semibold transition-[border-color,background-color,color] duration-150"
        style={{
          borderColor: style ? `${style.color}60` : "var(--border)",
          background: style ? style.bg : "var(--bg)",
          color: style ? style.color : "var(--fg3)",
        }}
      >
        {style ? (
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: style.color }} />
        ) : (
          <span className="text-[10px] leading-none">▾</span>
        )}
        {style ? style.label : "카테고리"}
        <span className="text-[9px] leading-none opacity-60">▾</span>
      </button>
      {open ? (
        <div
          className="fade-in absolute top-[calc(100%+4px)] left-0 z-50 min-w-[130px] rounded-[10px] border border-border bg-card p-1.5"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
          role="listbox"
        >
          {choices.map((label) => {
            const item = categoryStyle(label);
            const isOn = selected === label;
            return (
              <button
                key={label}
                type="button"
                role="option"
                aria-selected={isOn}
                onClick={() => onSelect(label)}
                className="flex w-full cursor-pointer items-center gap-[7px] rounded-[7px] border-0 px-2.5 py-[7px] text-left text-[13px] transition-colors duration-100"
                style={{
                  background: isOn ? item.bg : "transparent",
                  color: isOn ? item.color : "var(--fg)",
                  fontWeight: isOn ? 700 : 500,
                }}
              >
                <span className="size-[7px] shrink-0 rounded-full" style={{ background: item.color }} />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function EventDateButton({
  value,
  today,
  defaultMonth,
  onChange,
  ariaLabel = "D-Day 날짜",
  align = "end",
  showSelected = true,
  triggerClassName,
  children,
}: {
  value: string;
  today: Date;
  defaultMonth?: number;
  onChange: (iso: string) => void;
  ariaLabel?: string;
  align?: "start" | "center" | "end";
  showSelected?: boolean;
  triggerClassName?: string;
  children?: ReactNode;
}) {
  const picked = showSelected && Boolean(isoDateParts(value));
  const pickedDate = picked ? dateFromIso(value) : null;
  const wrapRef = useRef<HTMLDivElement>(null);
  const jumpOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpYear, setJumpYear] = useState(() => today.getFullYear());
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const [view, setView] = useState(() => viewFromValue(value, today, defaultMonth));
  jumpOpenRef.current = jumpOpen;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-date-picker]")) return;
      setOpen(false);
      setJumpOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (jumpOpenRef.current) {
        setJumpOpen(false);
        return;
      }
      setOpen(false);
    }
    function onReposition() {
      setOpen(false);
      setJumpOpen(false);
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

  function placeAndOpen() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 256;
      const height = 292;
      const rawLeft =
        align === "start"
          ? rect.left
          : align === "center"
            ? rect.left + rect.width / 2 - width / 2
            : rect.right - width;
      const left = Math.min(Math.max(8, rawLeft), window.innerWidth - width - 8);
      const top =
        rect.bottom + 4 + height > window.innerHeight - 8
          ? Math.max(8, rect.top - height - 4)
          : rect.bottom + 4;
      setAnchor({ top, left });
    }
    const next = viewFromValue(value, today, defaultMonth);
    setView(next);
    setJumpYear(next.year);
    setJumpOpen(false);
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function jumpToMonth(monthIndex: number) {
    setView({ year: jumpYear, month: monthIndex });
    setJumpOpen(false);
  }

  function pickDay(day: number) {
    const iso = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
    setOpen(false);
    setJumpOpen(false);
  }

  const cells = monthCells(view.year, view.month);
  const monthLabel = `${view.year}년 ${view.month + 1}월`;

  return (
    <div ref={wrapRef} className="relative" data-date-picker="">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            setJumpOpen(false);
          } else placeAndOpen();
        }}
        className={
          triggerClassName ??
          "inline-flex cursor-pointer items-center gap-[5px] rounded-lg border px-2.5 py-[5px] text-[12px] font-semibold whitespace-nowrap transition-[border-color,background-color,color] duration-150"
        }
        style={
          children
            ? undefined
            : {
                borderColor: picked ? "var(--accent)" : "var(--border)",
                background: picked ? "rgba(0,102,255,0.06)" : "var(--bg)",
                color: picked ? "var(--accent)" : "var(--fg3)",
              }
        }
      >
        {children ?? (
          <>
            <CalendarBlank size={12} weight="bold" aria-hidden="true" />
            {picked ? formatPickedDateLabel(value, today) : "D-Day 날짜"}
          </>
        )}
      </button>
      {open
        ? createPortal(
            <div
              data-date-picker=""
              role="dialog"
              aria-label="날짜 선택"
              className="fade-in fixed z-[80] w-[256px] rounded-[10px] border border-border bg-card p-2.5"
              style={{ top: anchor.top, left: anchor.left, boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={jumpOpen ? "이전 해" : "이전 달"}
                  onClick={() => {
                    if (jumpOpen) setJumpYear((year) => year - 1);
                    else shiftMonth(-1);
                  }}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-[14px] text-fg2"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="연도와 월 점프"
                  aria-expanded={jumpOpen}
                  onClick={() => {
                    setJumpYear(view.year);
                    setJumpOpen((prev) => !prev);
                  }}
                  className="inline-flex min-w-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[13px] font-semibold text-fg"
                >
                  {jumpOpen ? `${jumpYear}년` : monthLabel}
                  <span className="text-[9px] leading-none opacity-60">{jumpOpen ? "▴" : "▾"}</span>
                </button>
                <button
                  type="button"
                  aria-label={jumpOpen ? "다음 해" : "다음 달"}
                  onClick={() => {
                    if (jumpOpen) setJumpYear((year) => year + 1);
                    else shiftMonth(1);
                  }}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-[14px] text-fg2"
                >
                  ›
                </button>
              </div>
              {jumpOpen ? (
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 12 }, (_, monthIndex) => {
                    const active = jumpYear === view.year && monthIndex === view.month;
                    const isCurrent = jumpYear === today.getFullYear() && monthIndex === today.getMonth();
                    return (
                      <button
                        key={monthIndex}
                        type="button"
                        onClick={() => jumpToMonth(monthIndex)}
                        className="cursor-pointer rounded-md py-2 text-[13px] transition-colors duration-100"
                        style={{
                          background: active ? "var(--accent)" : "transparent",
                          color: active ? "#fff" : isCurrent ? "var(--accent)" : "var(--fg)",
                          fontWeight: active || isCurrent ? 700 : 500,
                        }}
                      >
                        {monthIndex + 1}월
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-px">
                  {WEEKDAYS.map((day) => (
                    <span
                      key={day}
                      className="flex h-7 items-center justify-center text-[10px] font-semibold text-fg3"
                    >
                      {day}
                    </span>
                  ))}
                  {cells.map((day, index) => {
                    if (!day) {
                      return <span key={`empty-${index}`} className="size-[30px]" />;
                    }
                    const selected =
                      pickedDate !== null &&
                      view.year === pickedDate.getFullYear() &&
                      view.month === pickedDate.getMonth() &&
                      day === pickedDate.getDate();
                    const isToday =
                      view.year === today.getFullYear() &&
                      view.month === today.getMonth() &&
                      day === today.getDate();
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pickDay(day)}
                        className="flex size-[30px] cursor-pointer items-center justify-center rounded-md text-[12px] font-medium"
                        style={{
                          background: selected ? "var(--accent)" : "transparent",
                          color: selected ? "#fff" : isToday ? "var(--accent)" : "var(--fg)",
                          fontWeight: selected || isToday ? 700 : 500,
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
