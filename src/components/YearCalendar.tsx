import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { ClubData } from "../lib/types";
import { TODAY } from "../lib/board";
import {
  LEGEND,
  WEEKDAYS,
  type CalendarEvent,
  type LegendId,
  buildCalendarEvents,
  dateKey,
  dotsForEvents,
  formatPanelDate,
  legendById,
  monthCells,
  sameDay,
  visibleEvents,
} from "../lib/calendar";

const PHOTO_KEY = "uniclub-cal-photos-v1";

type YearCalendarProps = {
  data: ClubData;
};

function loadPhotos(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function savePhotos(photos: Record<string, string[]>) {
  localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
}

export function YearCalendar({ data }: YearCalendarProps) {
  const allEvents = useMemo(() => buildCalendarEvents(data), [data]);
  const [cursor, setCursor] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [filter, setFilter] = useState<LegendId | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[]>>(() => loadPhotos());

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const cells = monthCells(year, monthIndex);
  const panelOpen = selected !== null;

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of allEvents) {
      const key = dateKey(event.date);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [allEvents]);

  function eventsOn(day: number): CalendarEvent[] {
    return eventsByDay.get(dateKey(new Date(year, monthIndex, day))) ?? [];
  }

  function toggleFilter(id: LegendId) {
    setFilter((current) => (current === id ? null : id));
  }

  function toggleDay(day: number) {
    const next = new Date(year, monthIndex, day);
    setSelected((current) => (current && sameDay(current, next) ? null : next));
  }

  function shiftMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelected(null);
  }

  function addPhoto(eventId: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (!url) return;
      setPhotos((prev) => {
        const next = { ...prev, [eventId]: [...(prev[eventId] ?? []), url] };
        savePhotos(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  const selectedEvents = selected
    ? visibleEvents(eventsByDay.get(dateKey(selected)) ?? [], filter)
    : [];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-screen lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:p-5">
        <section className="rounded-[12px] border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h1 className="tabular text-[16px] font-semibold tracking-[-0.02em] text-ink">
              {year}년 {monthIndex + 1}월
            </h1>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => shiftMonth(-1)}
                className="flex size-8 items-center justify-center rounded-[6px] text-muted"
              >
                <CaretLeft size={14} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => shiftMonth(1)}
                className="flex size-8 items-center justify-center rounded-[6px] text-muted"
              >
                <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-7 px-3 pb-4 pt-2 sm:px-5">
            {WEEKDAYS.map((label) => (
              <p key={label} className="py-2 text-center text-[12px] text-muted">
                {label}
              </p>
            ))}
            {cells.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="min-h-[64px]" />;
              }
              const dayDate = new Date(year, monthIndex, day);
              const isSelected = selected !== null && sameDay(selected, dayDate);
              const dots = dotsForEvents(eventsOn(day), filter);
              return (
                <button
                  key={day}
                  type="button"
                  aria-selected={isSelected}
                  aria-expanded={isSelected}
                  onClick={() => toggleDay(day)}
                  className="flex min-h-[64px] flex-col items-center pt-1.5"
                >
                  <span
                    className={`tabular inline-flex size-8 items-center justify-center text-[14px] text-ink ${
                      isSelected ? "rounded-full bg-cal-selected" : ""
                    }`}
                  >
                    {day}
                  </span>
                  <span className="mt-0.5 flex min-h-[6px] items-center justify-center gap-0.5">
                    {dots.map((kind) => (
                      <span
                        key={kind}
                        className={`size-1.5 rounded-full ${legendById(kind).colorClass}`}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[12px] border border-line bg-surface px-5 py-4">
          <p className="text-[13px] text-muted">
            항목 선택 시 해당 항목만, 다시 선택하면 전체 항목이 표시됩니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {LEGEND.map((item) => {
              const pressed = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleFilter(item.id)}
                  className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] text-ink ${
                    pressed ? "bg-line" : ""
                  }`}
                >
                  <span className={`size-2 rounded-full ${item.colorClass}`} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <aside
        className={`min-h-0 shrink-0 overflow-hidden border-line bg-surface transition-[width] duration-200 ease-out max-lg:border-t lg:h-full lg:border-l ${
          panelOpen ? "w-full lg:w-[340px]" : "w-0 max-lg:h-0 max-lg:border-0"
        }`}
        aria-hidden={!panelOpen}
        aria-label={selected ? formatPanelDate(selected) : undefined}
      >
        {selected ? (
          <div className="flex h-full w-full flex-col overflow-auto lg:w-[340px]">
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                {formatPanelDate(selected)}
              </h2>
            </header>
            <div className="flex-1 px-5 py-4">
              {selectedEvents.length === 0 ? (
                <p className="text-[13px] text-muted">이 날 등록된 행사가 없습니다</p>
              ) : (
                <ul className="space-y-6">
                  {selectedEvents.map((event) => (
                    <li key={event.id}>
                      <h3 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                        {event.name}
                      </h3>
                      {event.details ? (
                        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                          {event.details}
                        </p>
                      ) : null}
                      <div className="mt-4">
                        <p className="text-[13px] font-medium text-ink">행사 사진</p>
                        {(photos[event.id] ?? []).length > 0 ? (
                          <ul className="mt-2 grid grid-cols-2 gap-2">
                            {(photos[event.id] ?? []).map((src, photoIndex) => (
                              <li key={`${event.id}-${photoIndex}`}>
                                <img
                                  src={src}
                                  alt=""
                                  className="h-24 w-full rounded-[8px] border border-line object-cover"
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <label className="mt-2 inline-flex cursor-pointer rounded-[6px] border border-line px-3 py-1.5 text-[13px] text-ink">
                          + 사진 첨부
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(eventChange) => {
                              const file = eventChange.target.files?.[0];
                              if (file) addPhoto(event.id, file);
                              eventChange.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
