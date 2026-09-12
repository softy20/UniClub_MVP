import { useState } from "react";
import { ALL_CATS, CATS, type FigmaCat, type OpsEvent } from "../lib/ops";
import { monthCells } from "../lib/calendar";
import type { KstClock } from "../lib/kst";
import { CategoryFilter } from "./marks";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

type MakeCalendarProps = {
  events: OpsEvent[];
  clock: KstClock;
  onSelect: (event: OpsEvent) => void;
};

export function MakeCalendar({ events, clock, onSelect }: MakeCalendarProps) {
  const [viewYear, setViewYear] = useState(clock.year);
  const [viewMonth, setViewMonth] = useState(clock.month);
  const [active, setActive] = useState<Set<FigmaCat>>(new Set(ALL_CATS));

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
  const filtered = events.filter(
    (event) =>
      active.has(event.category) &&
      event.date.getFullYear() === viewYear &&
      event.date.getMonth() + 1 === viewMonth,
  );

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
            setActive((prev) => (prev.size === ALL_CATS.length ? new Set() : new Set(ALL_CATS)))
          }
        />
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
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => onSelect(event)}
                            className="w-full cursor-pointer rounded px-1.5 py-0.5 text-left hover:opacity-80"
                            style={{ background: CATS[event.category].bg }}
                          >
                            <p className="truncate text-[11px] font-medium leading-tight" style={{ color: CATS[event.category].color }}>
                              {event.title}
                            </p>
                          </button>
                        ))}
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
