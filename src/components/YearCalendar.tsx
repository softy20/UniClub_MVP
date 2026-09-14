import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { ClubData } from "../lib/types";
import { formatKstDateTime, readKst, type KstClock } from "../lib/kst";
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
  clock: KstClock;
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

export function YearCalendar({ data, clock }: YearCalendarProps) {
  const allEvents = useMemo(() => buildCalendarEvents(data), [data]);
  const [cursor, setCursor] = useState(() => {
    const now = readKst();
    return new Date(now.year, now.month - 1, 1);
  });
  const [filter, setFilter] = useState<LegendId | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[]>>(() => loadPhotos());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => readKst().year);
  const pickerRef = useRef<HTMLDivElement>(null);

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
    setSelected(new Date(year, monthIndex, day));
  }

  function closePanel() {
    setSelected(null);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setPickerOpen(false);
  }

  function togglePicker() {
    setPickerOpen((open) => {
      if (!open) setPickerYear(year);
      return !open;
    });
  }

  function jumpToMonth(nextMonthIndex: number) {
    setCursor(new Date(pickerYear, nextMonthIndex, 1));
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

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
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-4 p-4 lg:p-5">
        <section className="rounded-[12px] border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div ref={pickerRef} className="relative min-w-0">
              <h1 className="m-0 text-[16px] font-semibold tracking-[-0.02em] text-ink">
                <button
                  type="button"
                  aria-expanded={pickerOpen}
                  aria-haspopup="dialog"
                  aria-label="연도와 월 선택"
                  onClick={togglePicker}
                  className="flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 tabular tracking-[-0.02em] transition-colors duration-150 hover:bg-[#e6f5f5]"
                >
                  {year}년 {monthIndex + 1}월
                  <CaretDown
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className={`text-muted transition-transform duration-150 ${pickerOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </h1>
              {pickerOpen ? (
                <div
                  role="dialog"
                  aria-label="연도와 월 선택"
                  className="absolute left-0 top-[calc(100%+8px)] z-20 w-[220px] rounded-[12px] border border-line bg-surface p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      aria-label="이전 해"
                      onClick={() => setPickerYear((current) => current - 1)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]"
                    >
                      <CaretLeft size={14} weight="bold" aria-hidden="true" />
                    </button>
                    <p className="tabular text-[14px] font-medium text-ink">{pickerYear}년</p>
                    <button
                      type="button"
                      aria-label="다음 해"
                      onClick={() => setPickerYear((current) => current + 1)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]"
                    >
                      <CaretRight size={14} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, index) => {
                      const active = pickerYear === year && index === monthIndex;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => jumpToMonth(index)}
                          className={`cursor-pointer rounded-[6px] py-2 text-[13px] text-ink transition-colors duration-150 hover:bg-[#e6f5f5] ${
                            active ? "bg-cal-selected font-medium" : ""
                          }`}
                        >
                          {index + 1}월
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="tabular shrink-0 text-[12px] text-muted">{formatKstDateTime(clock)}</p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => shiftMonth(-1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]"
              >
                <CaretLeft size={14} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => shiftMonth(1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]"
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
              const isToday = clock.year === year && clock.month === monthIndex + 1 && clock.day === day;
              const dots = dotsForEvents(eventsOn(day), filter);
              return (
                <button
                  key={day}
                  type="button"
                  aria-selected={isSelected}
                  aria-expanded={isSelected}
                  onClick={() => toggleDay(day)}
                  className="flex min-h-[64px] cursor-pointer flex-col items-center rounded-[6px] pt-1.5 transition-colors duration-150 hover:bg-[#e6f5f5]"
                >
                  <span
                    className={`box-border tabular inline-flex size-8 items-center justify-center text-[14px] text-ink ${
                      isSelected ? "rounded-full bg-cal-selected" : ""
                    } ${isToday ? "rounded-full border-[1.5px] border-[#2563EB]" : ""}`}
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
                  className={`flex cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] text-ink transition-colors duration-150 hover:bg-[#e6f5f5] ${
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
      </div>

      <aside
        className={`flex h-full shrink-0 flex-col overflow-hidden bg-surface transition-[width] duration-200 ease-out ${
          panelOpen ? "w-[min(340px,100%)] border-l border-line" : "w-0"
        }`}
        aria-hidden={!panelOpen}
        aria-label={selected ? formatPanelDate(selected, clock.year) : undefined}
      >
        {selected ? (
          <div className="flex h-full w-[min(340px,100vw)] flex-col overflow-auto">
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                {formatPanelDate(selected, clock.year)}
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={closePanel}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]"
              >
                <X size={18} weight="bold" aria-hidden="true" />
              </button>
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
                        <label className="mt-2 inline-flex cursor-pointer rounded-[6px] border border-line px-3 py-1.5 text-[13px] text-ink transition-colors duration-150 hover:bg-[#e6f5f5]">
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
