import type { UpcomingEvent } from "../lib/types";
import { formatDate } from "../lib/board";

type EventDdayProps = {
  event: UpcomingEvent | null;
};

export function EventDday({ event }: EventDdayProps) {
  if (!event) {
    return (
      <section className="flex h-full flex-col justify-between rounded-[12px] border border-line bg-surface p-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">예정된 행사가 없습니다</h1>
        <p className="text-[13px] text-muted">연간 일정에 날짜가 생기면 여기에 표시됩니다.</p>
      </section>
    );
  }

  const label = event.daysLeft === 0 ? "오늘" : `D-${event.daysLeft}`;

  return (
    <section className="flex h-full flex-col justify-between rounded-[12px] border border-line bg-surface p-6">
      <div>
        <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink">{event.eventName}</h1>
        <p className="mt-2 text-[13px] text-muted">{formatDate(event.eventDate)}</p>
        {event.location ? <p className="mt-1 text-[13px] text-muted">{event.location}</p> : null}
      </div>
      <p className="tabular mt-8 text-[56px] font-semibold leading-none tracking-[-0.04em] text-ink">{label}</p>
    </section>
  );
}
