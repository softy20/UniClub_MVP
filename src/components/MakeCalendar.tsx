/**
 * 🧭 UniClub - MakeCalendar (달력 화면)
 *
 * 한 달치 달력을 그려주고, 그 달에 있는 행사들을 날짜 칸 안에 표시해 주는 화면입니다.
 * 이전 달/다음 달 이동, 특정 날짜로 바로 이동, 카테고리별로 행사 숨기고 보이기 기능이 들어 있습니다.
 *
 * 📌 주요 기능:
 * - 화면에 보여줄 달(년/월)을 계산하고, 그 달의 날짜 칸(빈칸 포함)을 만듭니다.
 * - 선택된 카테고리에 맞는 행사만 걸러서 각 날짜 칸에 보여줍니다.
 * - 이전 달, 다음 달 버튼과 날짜 직접 선택 버튼으로 원하는 달로 이동합니다.
 * - "오늘로 이동" 신호를 받으면 오늘이 있는 달로 화면을 옮깁니다.
 * - 특정 행사를 지정하면(focusEvent) 그 행사가 있는 달로 자동으로 이동합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { MakeCalendar } from "./components/MakeCalendar";
 * <MakeCalendar
 *   events={events}
 *   clock={kstClock}
 *   onSelect={(event) => openEventDetail(event)}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): events(행사 목록), clock(오늘 날짜 정보),
 *   onSelect(행사를 눌렀을 때 실행할 함수), focusEvent(집중해서 보여줄 행사),
 *   focusToday(오늘로 이동할지 여부), onTodayFocused(오늘 이동이 끝났음을 알리는 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): viewYear/viewMonth(현재 보고 있는 년/월),
 *   active(현재 켜져 있는 카테고리 목록)
 * - 내부에서만 쓰는 함수: isDated(날짜가 있는 행사인지 확인), focusMonth(처음에 보여줄 달 계산)
 *
 * 💡 팁 및 주의사항:
 * - 날짜가 없는(모호한) 행사는 달력에 표시되지 않고 제외됩니다.
 * - 카테고리 목록이 바뀌면(예: 새로운 분류가 생기면) 선택 상태가 자동으로 초기화됩니다(전체 선택).
 * - 달력 칸 하나에 행사가 4개 이상이면 3개만 보여주고 "+N"으로 나머지 개수를 표시합니다.
 *
 * @file MakeCalendar.tsx
 * @module components/MakeCalendar
 */
import { useEffect, useMemo, useState } from "react";
import { categoryStyle, uniqueCategoryLabels, type OpsEvent } from "../lib/ops";
import { monthCells } from "../lib/calendar";
import type { KstClock } from "../lib/kst";
import { EventDateButton, isoDateParts } from "./EventEditors";
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
  focusToday?: boolean;
  onTodayFocused?: () => void;
};

export function MakeCalendar({
  events,
  clock,
  onSelect,
  focusEvent,
  focusToday = false,
  onTodayFocused,
}: MakeCalendarProps) {
  const initial = focusToday
    ? { year: clock.year, month: clock.month }
    : focusMonth(events, clock);
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

  useEffect(() => {
    if (!focusToday) return;
    setViewYear(clock.year);
    setViewMonth(clock.month);
    onTodayFocused?.();
  }, [focusToday, clock.year, clock.month, onTodayFocused]);

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
          <EventDateButton
            value={`${viewYear}-${String(viewMonth).padStart(2, "0")}-01`}
            today={clock.civil}
            defaultMonth={viewMonth}
            align="center"
            showSelected={false}
            ariaLabel={`${monthLabel} 점프`}
            triggerClassName="inline-flex min-w-[130px] cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1 text-[22px] font-bold text-fg transition-colors duration-150 hover:bg-card"
            onChange={(iso) => {
              const parts = isoDateParts(iso);
              if (!parts) return;
              setViewYear(parts.year);
              setViewMonth(parts.month);
            }}
          >
            {monthLabel}
            <span className="text-[10px] leading-none font-semibold opacity-50" aria-hidden="true">
              ▾
            </span>
          </EventDateButton>
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
