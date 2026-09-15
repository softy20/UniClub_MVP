import { useEffect, useMemo, useState } from "react";
import { categoryStyle, uniqueCategoryLabels, type OpsEvent } from "../lib/ops";
import { monthCells } from "../lib/calendar";
import type { KstClock } from "../lib/kst";
import { CategoryFilter } from "./marks";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function isDated(event: OpsEvent): boolean {
  return Number.isFinite(event.date.getTime());
}

function focusMonth(events: OpsEvent[], clock: KstClock): { year: number; month: number } {
  const dated = events.filter(isDated);
  const upcoming = dated.filter((event) => event.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const pick = upcoming ?? dated[0];
  if (!pick) return { year: clock.year, month: clock.month };
  return { year: pick.date.getFullYear(), month: pick.date.getMonth() + 1 };
}

type MakeCalendarProps = {
  events: OpsEvent[];
  clock: KstClock;
  onSelect: (event: OpsEvent) => void;
  focusEvent?: OpsEvent | null;
};

export function MakeCalendar({ events, clock, onSelect, focusEvent }: MakeCalendarProps) {
  const initial = focusMonth(events, clock);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const categories = useMemo(() => uniqueCategoryLabels(events), [events]);
  const [active, setActive] = useState<Set<string>>(() => new Set(categories));
  const categoryKey = categories.join("|");
  const focusTime = focusEvent?.date.getTime();

  useEffect(() => {
    setActive(new Set(categories));
  }, [categoryKey]);

  useEffect(() => {
    if (!focusEvent || !Number.isFinite(focusEvent.date.getTime())) return;
    setViewYear(focusEvent.date.getFullYear());
    setViewMonth(focusEvent.date.getMonth() + 1);
  }, [focusEvent?.id, focusTime]);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  }

  const cells = monthCells(viewYear, viewMonth - 1);
  const monthLabel = viewYear === clock.year ? `${viewMonth}월` : `${viewYear}년 ${viewMonth}월`;
  const dated = events.filter(isDated);
  const filtered = dated.filter(
    (event) =>
      active.has(event.category) &&
      event.date.getFullYear() === viewYear &&
      event.date.getMonth() + 1 === viewMonth,
  );
  const elsewhere = dated.filter(
    (event) => event.date.getFullYear() !== viewYear || event.date.getMonth() + 1 !== viewMonth,
  );

  function goToEvents() {
    const next = focusMonth(events, clock);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  return (
    <div className="fade-in flex flex-col bg-bg">
      <div className="flex items-center justify-between bg-bg px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-base text-fg2"
          >
            ‹
          </button>
          <div className="w-[130px] text-center">
            <span className="text-[22px] font-bold text-fg">{monthLabel}</span>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-base text-fg2"
          >
            ›
          </button>
        </div>
      </div>

      <div className="bg-bg px-6 pb-4">
        <CategoryFilter
          events={events}
          active={active}
          onToggle={(cat) => {
            setActive((prev) => {
              const next = new Set(prev);
              if (next.has(cat)) next.delete(cat);
              else next.add(cat);
              return next;
            });
          }}
          onToggleAll={() =>
            setActive((prev) =>
              categories.every((cat) => prev.has(cat)) ? new Set() : new Set(categories),
            )
          }
        />
        {filtered.length === 0 && elsewhere.length > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[13px] text-fg2">
              이달 표시할 행사가 없습니다. 전체 {dated.length}개 중 {elsewhere.length}개는 다른 달에 있습니다.
            </p>
            <button
              type="button"
              onClick={goToEvents}
              className="shrink-0 cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              행사 달로 이동
            </button>
          </div>
        ) : null}
      </div>

      <div className="px-6 pb-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_KO.map((label, index) => (
              <div
                key={label}
                className="py-2.5 text-center text-[13px] font-medium"
                style={{
                  color: index === 0 ? "#ef4444" : index === 6 ? "#3b82f6" : "var(--fg3)",
                  borderRight: index < 6 ? "1px solid var(--border)" : "none",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{ gridAutoRows: "110px" }}>
            {cells.map((day, index) => {
              const dow = index % 7;
              const row = Math.floor(index / 7);
              const totalRows = Math.ceil(cells.length / 7);
              const dayEvents = day ? filtered.filter((event) => event.date.getDate() === day) : [];
              const isToday = day === clock.day && viewMonth === clock.month && viewYear === clock.year;
              return (
                <div
                  key={`${viewYear}-${viewMonth}-${index}`}
                  className="p-2"
                  style={{
                    minHeight: "100px",
                    background: !day ? "#F7F7F8" : isToday ? "rgba(0,102,255,0.04)" : "transparent",
                    borderRight: dow < 6 ? "1px solid var(--border)" : "none",
                    borderBottom: row < totalRows - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {day ? (
                    <>
                      <div
                        className="mb-1 inline-flex items-center justify-center text-[14px]"
                        style={{
                          width: isToday ? "26px" : "auto",
                          height: isToday ? "26px" : "auto",
                          borderRadius: isToday ? "50%" : "0",
                          background: isToday ? "var(--accent)" : "transparent",
                          fontWeight: isToday ? 700 : 400,
                          color: isToday ? "#fff" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "var(--fg)",
                        }}
                      >
                        {day}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => {
                          const cat = categoryStyle(event.category);
                          return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => onSelect(event)}
                            className="w-full cursor-pointer rounded px-1.5 py-0.5 text-left hover:opacity-80"
                            style={{ background: cat.bg }}
                          >
                            <p className="truncate text-[11px] font-medium leading-tight" style={{ color: cat.color }}>
                              {event.title}
                            </p>
                          </button>
                          );
                        })}
                        {dayEvents.length > 3 ? (
                          <p className="pl-1 text-[10px] text-fg3">+{dayEvents.length - 3}</p>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
